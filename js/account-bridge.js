(() => {
  'use strict';

  const config = window.XIAOXING_ACCOUNT_CONFIG;
  const hasConfig = Boolean(config && (config.serverOrigin || config.mirrorReturnUrl));
  const noncePattern = /^[A-Za-z0-9_-]{43}$/;
  const maxAge = 10 * 60 * 1000;
  const actionValues = new Set(['login', 'register', 'forgot']);
  const languageValues = new Set(['zh', 'en', 'ru']);
  const urlFields = ['xx_return', 'xx_challenge', 'xx_state', 'xx_action', 'xx_lang', 'xx_code'];
  const mirrorRoutes = new Map([
    ['me', 'GET'], ['messages', 'GET'], ['heartbeat', 'POST'], ['logout', 'POST'],
    ['agreement', 'POST'], ['email', 'POST'], ['payment-submit', 'POST'],
    ['messages/read', 'POST'], ['messages/send', 'POST']
  ]);
  const landing = new URL(window.location.href);
  const server = trustedUrl(config?.serverOrigin);
  const returnPage = trustedUrl(config?.mirrorReturnUrl);
  const onMirror = Boolean(server?.pathname === '/' && returnPage && server.origin !== returnPage.origin &&
    landing.origin === returnPage.origin && (landing.pathname === returnPage.pathname ||
      (returnPage.pathname.endsWith('/') && landing.pathname === returnPage.pathname + 'index.html')));
  const onCentral = !hasConfig && trustedUrl(landing.origin)?.origin === landing.origin;
  const mirrorKey = onMirror ? `xiaoxing:account:mirror:${server.origin}:${returnPage.pathname}` : '';
  const pendingKey = mirrorKey + ':pending';
  const tokenKey = mirrorKey + ':access';
  const requestKey = 'xiaoxing:account:connect';
  const callbackPage = onMirror && landing.pathname === returnPage.pathname;
  const query = new URLSearchParams(landing.search);
  const fields = Object.fromEntries(urlFields.map(key => [key, query.get(key)]));
  const hasFields = urlFields.some(key => query.has(key));
  const uniqueFields = urlFields.every(key => query.getAll(key).length <= 1);
  let historyScrubbed = !hasFields;
  if (hasFields) {
    for (const key of urlFields) landing.searchParams.delete(key);
    try {
      window.history.replaceState(window.history.state, '', landing.href);
      historyScrubbed = true;
    } catch (_) { /* A callback with an unscrubbed URL is never redeemed. */ }
  }

  const savedToken = onMirror ? read(tokenKey) : null;
  let token = noncePattern.test(savedToken) ? savedToken : null;
  let requestVersion = 0;
  let callbackPending = onMirror && query.has('xx_code');
  let exchange = null;
  let pending = onCentral ? readIncoming() : null;

  if (onCentral && hasFields) {
    pending = historyScrubbed && uniqueFields && !query.has('xx_code') ? validatedIncoming({
      returnUrl: fields.xx_return, challenge: fields.xx_challenge, state: fields.xx_state,
      action: fields.xx_action, lang: fields.xx_lang, createdAt: Date.now()
    }) : null;
    if (pending) write(requestKey, JSON.stringify(pending));
    else remove(requestKey);
  }

  function trustedUrl(value) {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value) || /[\s?#\\]/.test(value)) return null;
    const authority = value.split('/')[2];
    if (!authority || authority.includes('@')) return null;
    try {
      const url = new URL(value);
      if (url.username || url.password) return null;
      if (url.protocol === 'https:' || (url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) return url;
    } catch (_) { /* The site requires an explicit account-server and mirror URL. */ }
    return null;
  }

  function read(key) {
    try { return window.sessionStorage.getItem(key); }
    catch (_) { return null; }
  }

  function readJson(key) {
    try { return JSON.parse(read(key)); }
    catch (_) { return null; }
  }

  function write(key, value) {
    try { window.sessionStorage.setItem(key, value); return true; }
    catch (_) { return false; }
  }

  function remove(key) {
    try { window.sessionStorage.removeItem(key); }
    catch (_) { /* In-memory state is also cleared by callers. */ }
  }

  function isFresh(time) {
    const age = Date.now() - time;
    return Number.isFinite(time) && age >= 0 && age <= maxAge;
  }

  function validatedIncoming(value) {
    const url = trustedUrl(value?.returnUrl);
    if (!url || url.origin === landing.origin || !noncePattern.test(value.challenge) ||
        !noncePattern.test(value.state) || !isFresh(value.createdAt)) return null;
    return { returnUrl: url.href, challenge: value.challenge, state: value.state, createdAt: value.createdAt,
      action: actionValues.has(value.action) ? value.action : 'login',
      lang: languageValues.has(value.lang) ? value.lang : 'zh' };
  }

  function readIncoming() {
    return validatedIncoming(readJson(requestKey));
  }

  function incoming() {
    if (!pending || !isFresh(pending.createdAt)) {
      if (pending) clearIncoming();
      return null;
    }
    const { createdAt, ...connection } = pending;
    return connection;
  }

  function clearIncoming() {
    pending = null;
    if (onCentral) remove(requestKey);
  }

  function fail(code, status = 0) {
    return Object.assign(new Error(code), { code, status });
  }

  function base64url(bytes) {
    return window.btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  async function start(action = 'login', lang = 'zh') {
    if (!onMirror || !actionValues.has(action)) throw fail('invalid_mirror');
    const crypto = window.crypto;
    if (!crypto?.subtle) throw fail('secure_context_required');
    const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = base64url(new Uint8Array(digest));
    if (!write(pendingKey, JSON.stringify({ state, verifier, returnUrl: returnPage.href, createdAt: Date.now() }))) {
      throw fail('storage_unavailable');
    }
    const url = new URL('/', server);
    url.searchParams.set('xx_return', returnPage.href);
    url.searchParams.set('xx_challenge', challenge);
    url.searchParams.set('xx_state', state);
    url.searchParams.set('xx_action', action);
    url.searchParams.set('xx_lang', languageValues.has(lang) ? lang : 'zh');
    window.location.assign(url.href);
  }

  function complete(connection, redirectUrl) {
    const active = incoming();
    let redirect;
    try { redirect = new URL(redirectUrl); }
    catch (_) { throw fail('invalid_redirect'); }
    if (!active || active.state !== connection?.state || active.returnUrl !== connection.returnUrl ||
        active.challenge !== connection.challenge || redirect.username || redirect.password || redirect.hash ||
        Array.from(redirect.searchParams).length !== 2 || !noncePattern.test(redirect.searchParams.get('xx_code')) ||
        redirect.searchParams.get('xx_state') !== active.state) throw fail('invalid_redirect');
    const target = new URL(redirect);
    target.search = '';
    if (target.href !== active.returnUrl) throw fail('invalid_redirect');
    clearIncoming();
    window.location.assign(redirect.href);
  }

  async function fetchJson(path, method, data, accessToken) {
    if (!onMirror) throw fail('invalid_mirror');
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 10000) : null;
    const headers = { Accept: 'application/json' };
    if (method === 'POST') headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
    try {
      const response = await fetch(new URL(path, server), {
        method, headers, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
        body: method === 'POST' ? JSON.stringify(data ?? {}) : undefined,
        signal: controller?.signal
      });
      let result;
      if (/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
        try { result = await response.json(); }
        catch (_) { /* An invalid JSON response is handled below. */ }
      }
      if (!response.ok || !result) throw fail(result?.code || 'request_failed', response.status);
      return result;
    } catch (error) {
      if (typeof error?.status === 'number') throw error;
      throw fail('request_failed');
    } finally {
      if (timeout !== null) clearTimeout(timeout);
    }
  }

  function consumeCallback() {
    if (callbackPending) {
      callbackPending = false;
      exchange = exchangeCallback().finally(() => { exchange = null; });
    }
    return exchange ?? Promise.resolve(null);
  }

  async function exchangeCallback() {
    const saved = readJson(pendingKey);
    if (!callbackPage || !historyScrubbed || !uniqueFields || ['xx_return', 'xx_challenge', 'xx_action', 'xx_lang'].some(key => query.has(key)) ||
        !noncePattern.test(fields.xx_code) || !noncePattern.test(fields.xx_state) ||
        !saved || !isFresh(saved.createdAt) || !noncePattern.test(saved.verifier) ||
        saved.state !== fields.xx_state || saved.returnUrl !== returnPage.href) throw fail('invalid_callback');
    remove(pendingKey);
    const version = requestVersion;
    const result = await fetchJson('/api/auth/exchange', 'POST', {
      code: fields.xx_code, verifier: saved.verifier, returnUrl: returnPage.href
    });
    if (version !== requestVersion) return null;
    if (!noncePattern.test(result.accessToken) || typeof result.user?.id !== 'string' || typeof result.user?.username !== 'string') {
      throw fail('invalid_callback');
    }
    token = result.accessToken;
    write(tokenKey, token);
    return { user: result.user };
  }

  function clearSession() {
    requestVersion++;
    token = null;
    if (onMirror) remove(tokenKey);
  }

  async function request(path, data) {
    const method = mirrorRoutes.get(path);
    if (!onMirror || !method) throw fail('invalid_mirror');
    if (!token) {
      if (path === 'me') return { user: null };
      throw fail('unauthorized', 401);
    }
    const current = token;
    try {
      const result = await fetchJson('/api/auth/' + path, method, data, current);
      if (token === current && (path === 'logout' || (path === 'me' && result.user === null))) clearSession();
      return result;
    } catch (error) {
      if (error.status === 401 && token === current) clearSession();
      throw error;
    }
  }

  window.XiaoxingAccount = Object.freeze({
    hasMirrorConfig: () => hasConfig, isMirror: () => onMirror, accountOrigin: () => onMirror ? server.origin : '',
    status: () => fetchJson('/api/status', 'GET'), request, start, consumeCallback, clearSession,
    incoming, complete, clearIncoming
  });
})();
