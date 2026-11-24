import { createServer } from 'node:http';
import { createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { readFile, mkdir, chmod } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DAY = 86400000;
const ONLINE = 5 * 60000;
const SESSION_DURATION = { user: 7 * DAY, admin: 8 * 3600000 };
const SESSION_COOKIE = { user: 'xiaoxing_user', admin: 'xiaoxing_admin' };
const COOKIE_PATH = { user: '/api/auth', admin: '/api/admin' };
const scrypt = promisify(scryptCb);
const sha = value => createHash('sha256').update(value).digest();
const iso = value => new Date(value).toISOString();
const dayText = value => iso(value).slice(0, 10);
const number = value => Number(value || 0);
const text = value => typeof value === 'string';
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const error = (status, code, message) => Object.assign(new Error(message), { status, code });
const managedPasswordRule = p => typeof p === 'string' && p.length >= 6 && p.length <= 128 && /\p{L}/u.test(p) && /[0-9]/.test(p);

const ASSETS = new Map(Object.entries({
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/admin': ['admin.html', 'text/html; charset=utf-8'],
  '/admin/': ['admin.html', 'text/html; charset=utf-8'],
  '/admin.html': ['admin.html', 'text/html; charset=utf-8'],
  '/css/style.css': ['css/style.css', 'text/css; charset=utf-8'],
  '/css/admin.css': ['css/admin.css', 'text/css; charset=utf-8'],
  '/js/app.js': ['js/app.js', 'text/javascript; charset=utf-8'],
  '/js/admin.js': ['js/admin.js', 'text/javascript; charset=utf-8'],
  '/js/managed-auth.js': ['js/managed-auth.js', 'text/javascript; charset=utf-8'],
  '/js/author-works.js': ['js/author-works.js', 'text/javascript; charset=utf-8'],
  '/js/draft-review.js': ['js/draft-review.js', 'text/javascript; charset=utf-8'],
  '/icons/xiaoxing-192.png': ['icons/xiaoxing-192.png', 'image/png'],
  '/icons/xiaoxing-512.png': ['icons/xiaoxing-512.png', 'image/png'],
  '/og-image.png': ['og-image.png', 'image/png'],
  '/qr-tip.png': ['qr-tip.png', 'image/png'],
  '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'],
  '/service-worker.js': ['service-worker.js', 'text/javascript; charset=utf-8'],
  '/version.txt': ['version.txt', 'text/plain; charset=utf-8'],
  '/changelog.json': ['changelog.json', 'application/json; charset=utf-8'],
  '/robots.txt': ['robots.txt', 'text/plain; charset=utf-8'],
  '/sitemap.xml': ['sitemap.xml', 'application/xml; charset=utf-8']
}));

function parseCredentials(body, registration) {
  const username = text(body.username) ? body.username.trim().normalize('NFKC') : '';
  const password = text(body.password) ? body.password : '';
  const length = [...username].length;
  if (length < 2 || length > 20 || !/^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Han}0-9_]+$/u.test(username)) {
    throw error(400, 'invalid_username', 'The username must contain 2–20 supported letters, digits, or underscores.');
  }
  if (password.length < (registration ? 6 : 1) || password.length > 128 ||
      (registration && (!/\p{L}/u.test(password) || !/[0-9]/.test(password)))) {
    throw error(400, 'invalid_password', 'The password must contain 6–128 characters, including a letter and a digit.');
  }
  return { username, usernameKey: username.toLowerCase(), password };
}

function collectCookies(header) {
  const out = Object.create(null);
  for (const segment of (header || '').split(';')) {
    const i = segment.indexOf('=');
    if (i > 0) out[segment.slice(0, i).trim()] = segment.slice(i + 1).trim();
  }
  return out;
}
function sessionCookie(role, token, secure, expired = false) {
  const maxAge = expired ? 0 : Math.floor(SESSION_DURATION[role] / 1000);
  return `${SESSION_COOKIE[role]}=${token}; Path=${COOKIE_PATH[role]}; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}
function publicUser(row, now = Date.now(), adminCheck = null) {
  if (!row) return null;
  const whitelisted = Boolean(row.whitelisted);
  const isAdmin = whitelisted || Boolean(adminCheck && adminCheck(row.username_key));
  return {
    id: row.id, username: row.username, createdAt: row.created_at, whitelisted,
    isAdmin, blocked: Boolean(row.blocked), hasQuestion: Boolean(row.question),
    trialEndsAt: row.trial_ends_at, plan: isAdmin || row.trial_ends_at > now ? 'flag' : 'free'
  };
}
function sendJson(res, status, data, headers = {}) {
  const body = Buffer.from(JSON.stringify(data));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length, 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
async function jsonBody(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    throw error(415, 'unsupported_content_type', 'Send application/json.');
  }
  const chunks = [];
  let len = 0;
  if (Number(req.headers['content-length']) > 16384) {
    req.resume();
    throw error(413, 'body_too_large', 'Request is too large.');
  }
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    len += chunk.length;
    if (len > 16384) {
      req.resume();
      throw error(413, 'body_too_large', 'Request is too large.');
    }
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!record(body)) throw new Error('object required');
    return body;
  } catch {
    throw error(400, 'invalid_json', 'Send a JSON object.');
  }
}
function validateOrigin(value) {
  if (!value) return '';
  const u = new URL(value);
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password ||
      u.pathname !== '/' || u.search || u.hash) throw new Error('XIAOXING_PUBLIC_ORIGIN must be a bare origin.');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !loopback) throw new Error('Public deployment requires an HTTPS origin.');
  return u.origin;
}
function normalizeTimestamp(value, now) {
  if (value == null || value === '') return now;
  const n = typeof value === 'number' ? value :
    text(value) && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN;
  if (!Number.isSafeInteger(n) || n < Date.UTC(2000, 0, 1) || n > now + 60000) {
    throw error(400, 'invalid_date', 'Provide a valid, non-future receipt timestamp.');
  }
  return n;
}
function keyForCookie(req, role, hashToken) {
  const raw = collectCookies(req.headers.cookie)[SESSION_COOKIE[role]];
  return /^[A-Za-z0-9_-]{43}$/.test(raw || '') ? hashToken(role, raw) : '';
}

export async function createXiaoxingServer(options = {}) {
  const password = options.adminPassword ?? process.env.XIAOXING_ADMIN_PASSWORD ?? '';
  if (typeof password !== 'string' || password.length < 16 || password.length > 1024) {
    throw new Error('Set XIAOXING_ADMIN_PASSWORD to a strong independent password (16–1024 characters).');
  }
  // 创作者授权的管理员账号（用户名白名单，由部署者通过环境变量维护；默认授权「小柚子」）
  const adminUsernamesRaw = options.adminUsernames ?? process.env.XIAOXING_ADMIN_USERNAMES ?? '小柚子';
  const adminUserSet = new Set(String(adminUsernamesRaw).split(',').map(s => s.trim().normalize('NFKC').toLowerCase()).filter(Boolean));
  const isAdminUsername = usernameKey => adminUserSet.has(usernameKey);
  const adminDigest = sha(password);
  // Rotating the administrator password makes any previous admin cookies unusable.
  const hashToken = (role, token) => (role === 'admin' ? createHmac('sha256', adminDigest).update(token).digest() : sha(token)).toString('hex');
  const origin = validateOrigin(options.publicOrigin ?? process.env.XIAOXING_PUBLIC_ORIGIN);
  const secure = origin.startsWith('https:');
  const configuredPath = options.dbPath ?? process.env.XIAOXING_DB_PATH ?? join(ROOT, '.data', 'xiaoxing.sqlite');
  const filename = configuredPath === ':memory:' ? ':memory:' : resolve(configuredPath);
  if (filename !== ':memory:') {
    await mkdir(dirname(filename), { mode: 0o700, recursive: true });
    const handle = await import('node:fs/promises').then(fs => fs.open(filename, 'a', 0o600));
    await handle.close();
    if (process.platform !== 'win32') await chmod(filename, 0o600);
  }
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA busy_timeout=5000;
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY, username TEXT NOT NULL, username_key TEXT NOT NULL UNIQUE,
      salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL,
      trial_ends_at INTEGER NOT NULL, whitelisted INTEGER NOT NULL DEFAULT 0 CHECK(whitelisted IN(0,1)),
      blocked INTEGER NOT NULL DEFAULT 0 CHECK(blocked IN(0,1)),
      question TEXT NOT NULL DEFAULT '', answer_hash TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS sessions(
      token_hash TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN('admin','user')),
      user_id TEXT REFERENCES users(id), expires_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL,
      CHECK ((role='admin' AND user_id IS NULL) OR (role='user' AND user_id IS NOT NULL))
    );
    CREATE TABLE IF NOT EXISTS payments(
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL CHECK(kind IN('payment','refund')),
      amount_cents INTEGER NOT NULL CHECK(amount_cents>0), reference TEXT NOT NULL UNIQUE,
      occurred_at INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', recorded_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS users_created ON users(created_at);
    CREATE INDEX IF NOT EXISTS sessions_presence ON sessions(role,last_seen_at,expires_at);
    CREATE INDEX IF NOT EXISTS payments_user_time ON payments(user_id,occurred_at);
    CREATE INDEX IF NOT EXISTS payments_time ON payments(occurred_at);
  `);
  // 旧库迁移：补充拉黑与密保字段
  const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map(row => row.name));
  if (!userColumns.has('blocked')) db.exec("ALTER TABLE users ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0 CHECK(blocked IN(0,1))");
  if (!userColumns.has('question')) db.exec("ALTER TABLE users ADD COLUMN question TEXT NOT NULL DEFAULT ''");
  if (!userColumns.has('answer_hash')) db.exec("ALTER TABLE users ADD COLUMN answer_hash TEXT NOT NULL DEFAULT ''");
  const stmt = sql => db.prepare(sql);
  const findUser = stmt('SELECT * FROM users WHERE username_key=?');
  const getUser = stmt('SELECT * FROM users WHERE id=?');
  const insertUser = stmt('INSERT INTO users (id,username,username_key,salt,password_hash,created_at,trial_ends_at) VALUES (?,?,?,?,?,?,?)');
  const getSession = stmt('SELECT * FROM sessions WHERE token_hash=? AND role=? AND expires_at>?');
  const insertSession = stmt('INSERT INTO sessions VALUES (?,?,?,?,?)');
  const delSession = stmt('DELETE FROM sessions WHERE token_hash=? AND role=?');
  const purgeSessions = stmt('DELETE FROM sessions WHERE expires_at<=?');
  const touchSession = stmt('UPDATE sessions SET last_seen_at=? WHERE token_hash=? AND role=\'user\' AND expires_at>?');
  const updateWhitelist = stmt('UPDATE users SET whitelisted=? WHERE id=?');
  const updateBlacklist = stmt('UPDATE users SET blocked=? WHERE id=?');
  const setPasswordHash = stmt('UPDATE users SET password_hash=? WHERE id=?');
  const setQuestion = stmt('UPDATE users SET question=?, answer_hash=? WHERE id=?');
  const clearUserSessions = stmt("DELETE FROM sessions WHERE role='user' AND user_id=?");
  const getPaymentRef = stmt('SELECT 1 FROM payments WHERE reference=?');
  const postPayment = stmt('INSERT INTO payments VALUES (?,?,?,?,?,?,?,?)');
  const ledgerByUser = stmt('SELECT kind,amount_cents,occurred_at FROM payments WHERE user_id=? ORDER BY occurred_at');
  const statusSQL = stmt('SELECT COUNT(*) AS total, COUNT(CASE WHEN created_at>=? THEN 1 END) AS in_period, COALESCE(SUM(whitelisted),0) AS whitelist FROM users');
  const onlineSQL = stmt("SELECT COUNT(DISTINCT user_id) AS active FROM sessions WHERE role='user' AND user_id IS NOT NULL AND last_seen_at>=? AND expires_at>?");
  const totalPayersSQL = stmt("SELECT COUNT(DISTINCT user_id) AS total FROM payments WHERE kind='payment'");
  const periodSQL = stmt(`SELECT COUNT(DISTINCT CASE WHEN kind='payment' THEN user_id END) AS total,
             SUM(CASE WHEN kind='payment' THEN amount_cents ELSE 0 END) AS gross,
             SUM(CASE WHEN kind='refund' THEN amount_cents ELSE 0 END) AS refunds
             FROM payments WHERE occurred_at>=? AND occurred_at<?`);
  const usersSQL = stmt(`SELECT u.id,u.username,u.created_at,u.trial_ends_at,u.whitelisted,u.blocked,u.question,COALESCE(x.net,0) AS net,COALESCE(x.has_paid,0) AS has_paid
    FROM users u LEFT JOIN (SELECT user_id,SUM(CASE WHEN kind='payment' THEN amount_cents ELSE -amount_cents END) AS net,COUNT(CASE WHEN kind='payment' THEN 1 END) AS has_paid
       FROM payments GROUP BY user_id) x ON x.user_id=u.id ORDER BY u.created_at DESC,u.id DESC`);
  const paymentsSQL = stmt(`SELECT p.id,p.user_id,u.username,p.kind,p.amount_cents,p.reference,p.occurred_at,p.note FROM payments p
    JOIN users u ON u.id=p.user_id WHERE p.occurred_at>=? AND p.occurred_at<? ORDER BY p.occurred_at DESC,p.recorded_at DESC,p.id DESC`);
  const usersByDay = stmt("SELECT date(created_at/1000,'unixepoch') AS day,COUNT(*) AS n FROM users WHERE created_at>=? AND created_at<? GROUP BY day");
  const ledgerByDay = stmt(`SELECT date(occurred_at/1000,'unixepoch') AS day,
    COUNT(CASE WHEN kind='payment' THEN 1 END) AS payments,COUNT(CASE WHEN kind='refund' THEN 1 END) AS refunds,
    SUM(CASE WHEN kind='payment' THEN amount_cents ELSE -amount_cents END) AS net
    FROM payments WHERE occurred_at>=? AND occurred_at<? GROUP BY day`);

  const attempts = new Map();
  let resetAttemptsAt = 0, lastSessionCleanup = 0, hashes = 0;
  function throttle(req, key, limit, windowMs, perAccount = '') {
    const n = Date.now();
    if (n >= resetAttemptsAt) {
      for (const [id, v] of attempts) if (v.until <= n) attempts.delete(id);
      resetAttemptsAt = n + 60000;
    }
    const id = [req.socket.remoteAddress, key, perAccount].join('|');
    const previous = attempts.get(id);
    const item = previous && previous.until > n ? previous : { hits: 0, until: n + windowMs };
    if (item.hits >= limit || (attempts.size >= 5000 && !previous)) {
      throw error(429, 'rate_limited', 'Too many attempts. Try again later.');
    }
    item.hits++;
    attempts.set(id, item);
  }
  async function passwordHash(pass, salt) {
    if (hashes >= 8) throw error(429, 'rate_limited', 'Authentication server is busy. Try again.');
    hashes++;
    try {
      return await scrypt(pass, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 48 * 1024 * 1024 });
    } finally { hashes--; }
  }
  function issueSession(req, role, userId = null) {
    const now = Date.now();
    if (now - lastSessionCleanup > 3600000) {
      purgeSessions.run(now);
      lastSessionCleanup = now;
    }
    const old = keyForCookie(req, role, hashToken);
    if (old) delSession.run(old, role);
    const raw = randomBytes(32).toString('base64url');
    insertSession.run(hashToken(role, raw), role, userId, now + SESSION_DURATION[role], now);
    return sessionCookie(role, raw, secure);
  }
  function session(req, role, required = true) {
    const key = keyForCookie(req, role, hashToken);
    const row = key && getSession.get(key, role, Date.now());
    if (!row && required) throw error(401, 'unauthorized', 'Sign in to continue.');
    return row || null;
  }
  function checkOrigin(req) {
    if (!origin && !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(req.headers.host || '')) {
      throw error(403, 'origin_forbidden', 'Set a public HTTPS origin before serving account or admin API requests.');
    }
    const expected = origin || `http://${req.headers.host}`;
    const mode = req.headers['sec-fetch-site'];
    if (req.headers.origin !== expected || (mode && mode !== 'same-origin')) {
      throw error(403, 'origin_forbidden', 'Only matching-origin requests are permitted.');
    }
  }
  function dashboard(url) {
    const daysText = url.searchParams.get('days') || '30';
    if (!['all', '7', '30', '90'].includes(daysText)) throw error(400, 'invalid_days', 'Use 7, 30, 90, or all days.');
    const now = Date.now(), dayStart = Math.floor(now / DAY) * DAY;
    const min = daysText === 'all' ? 0 : dayStart - (Number(daysText) - 1) * DAY;
    // All-time ledger includes every recorded entry, including small clock skew around midnight.
    const max = daysText === 'all' ? Math.max(dayStart + DAY, now + 60001) : dayStart + DAY;
    const counts = statusSQL.get(min), amounts = periodSQL.get(min, max);
    const daily = new Map();
    const ensure = date => {
      if (!daily.has(date)) daily.set(date, { date, registrations: 0, payments: 0, refunds: 0, netCents: 0 });
      return daily.get(date);
    };
    if (daysText !== 'all') for (let ts = min; ts < max; ts += DAY) ensure(dayText(ts));
    for (const r of usersByDay.all(min, max)) if (r.day) ensure(r.day).registrations = r.n;
    for (const r of ledgerByDay.all(min, max)) if (r.day) Object.assign(ensure(r.day), { payments: r.payments, refunds: r.refunds, netCents: number(r.net) });
    const gross = number(amounts.gross), refunds = number(amounts.refunds);
    return {
      days: daysText, timeZone: 'UTC', currency: 'CNY',
      totalUsers: counts.total, periodUsers: counts.in_period, onlineUsers: onlineSQL.get(now - ONLINE, now).active,
      totalPayers: totalPayersSQL.get().total, periodPayers: amounts.total,
      periodGrossCents: gross, periodRefundCents: refunds, periodNetCents: gross - refunds, whitelistCount: counts.whitelist,
      users: usersSQL.all().map(r => {
        const { trialEndsAt, ...user } = publicUser(r, now, isAdminUsername);
        return { ...user, netCents: number(r.net), hasPaid: Boolean(r.has_paid), blocked: Boolean(r.blocked), hasQuestion: Boolean(r.question) };
      }),
      payments: paymentsSQL.all(min, max).map(r => ({
        id:r.id, userId:r.user_id, username:r.username, kind:r.kind, amountCents:r.amount_cents,
        reference:r.reference, occurredAt:iso(r.occurred_at), note:r.note
      })),
      daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date))
    };
  }
  function captureReceipt(body) {
    const { userId, kind, amountCents } = body;
    const reference = text(body.reference) ? body.reference.normalize('NFKC').trim() : '';
    const note = body.note == null ? '' : body.note;
    if (!text(userId) || userId.length > 80 || !getUser.get(userId)) throw error(404, 'user_not_found', 'User not found.');
    if (!['payment','refund'].includes(kind)) throw error(400, 'invalid_kind', 'Select payment or refund.');
    if (!Number.isSafeInteger(amountCents) || amountCents < 1 || amountCents > 100000000) throw error(400, 'invalid_amount', 'Amount must be between 1 and 100,000,000 fen (CNY).');
    if (!reference || reference.length > 120 || /[\x00-\x1f\x7f]/.test(reference)) throw error(400, 'invalid_reference', 'A receipt reference up to 120 characters is required.');
    if (!text(note) || note.length > 500) throw error(400, 'invalid_note', 'Receipt note is limited to 500 characters.');
    const now = Date.now(), occurredAt = normalizeTimestamp(body.occurredAt, now);
    db.exec('BEGIN IMMEDIATE');
    try {
      if (getPaymentRef.get(reference)) throw error(409, 'duplicate_reference', 'This receipt reference is already recorded.');
      if (kind === 'refund') {
        const deltas = new Map([[occurredAt, -amountCents]]);
        for (const row of ledgerByUser.all(userId)) deltas.set(row.occurred_at,
          (deltas.get(row.occurred_at) || 0) + (row.kind === 'payment' ? row.amount_cents : -row.amount_cents));
        let balance = 0;
        for (const [, delta] of [...deltas].sort((a, b) => a[0] - b[0])) {
          balance += delta;
          if (balance < 0) throw error(409, 'refund_exceeds_payments', 'Refunds cannot exceed recorded payments as of that date.');
        }
      }
      const id = randomUUID();
      postPayment.run(id, userId, kind, amountCents, reference, occurredAt, note.trim(), now);
      db.exec('COMMIT');
      return { id, userId, kind, amountCents, reference, occurredAt: iso(occurredAt), note: note.trim() };
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  const originGate = req => {
    const mode = req.headers['sec-fetch-site'];
    if (mode && !['same-origin', 'none'].includes(mode)) throw error(403, 'origin_forbidden', 'Only matching-origin requests are permitted.');
  };
  async function api(req, res, url) {
    const route = url.pathname, method = req.method;
    if (method === 'GET' && route === '/api/status') return sendJson(res, 200, { managed: true });
    originGate(req);
    if (method === 'GET' && route === '/api/auth/me') {
      const u = session(req, 'user', false);
      if (u) touchSession.run(Date.now(), u.token_hash, Date.now());
      return sendJson(res, 200, { user: u ? publicUser(getUser.get(u.user_id), Date.now(), isAdminUsername) : null });
    }
    if (method === 'GET' && route === '/api/admin/dashboard') {
      session(req, 'admin');
      return sendJson(res, 200, dashboard(url));
    }
    if (!['POST','PUT'].includes(method)) throw error(404, 'not_found', 'Not found.');
    checkOrigin(req);
    if (method === 'POST' && ['/api/auth/register','/api/auth/login'].includes(route)) {
      const registration = route.endsWith('/register');
      throttle(req, registration ? 'register' : 'login', registration ? 30 : 65, 60000);
      const body = await jsonBody(req);
      const {username, usernameKey, password:pass} = parseCredentials(body, registration);
      if (!registration) throttle(req, 'login-account', 10, 60000, usernameKey);
      let u;
      if (registration) {
        const id = randomUUID(), salt = randomBytes(16).toString('hex');
        const hash = (await passwordHash(pass, salt)).toString('hex');
        const now = Date.now();
        // 密保问题（选填，用于找回密码）
        const questionKey = text(body.question) ? String(body.question).trim() : '';
        const answer = text(body.answer) ? String(body.answer).trim() : '';
        let question = '', answerHash = '';
        if (questionKey || answer) {
          if (!/^q[1-4]$/.test(questionKey) || answer.length < 2 || answer.length > 64) {
            throw error(400, 'invalid_question', 'Select a security question and provide an answer of 2–64 characters.');
          }
          question = questionKey;
          answerHash = (await passwordHash(answer, salt + ':q')).toString('hex');
        }
        try { insertUser.run(id, username, usernameKey, salt, hash, now, now + DAY); }
        catch (e) { if (findUser.get(usernameKey)) throw error(409, 'username_taken', 'This username is already registered.'); throw e; }
        if (question) setQuestion.run(question, answerHash, id);
        u = getUser.get(id);
      } else {
        const account = findUser.get(usernameKey);
        if (account && account.blocked) throw error(403, 'blocked', 'This account has been blocked. Contact the site operator.');
        const got = await passwordHash(pass, account?.salt || '23e219f40be9112fe16373894cad5fc8');
        const wanted = account ? Buffer.from(account.password_hash, 'hex') : Buffer.alloc(32);
        if (!timingSafeEqual(got, wanted) || !account) throw error(401, 'invalid_credentials', 'Username or password is incorrect.');
        u = account;
      }
      return sendJson(res, registration ? 201 : 200, { user: publicUser(u, Date.now(), isAdminUsername) }, { 'Set-Cookie': issueSession(req, 'user', u.id) });
    }
    if (method === 'POST' && route === '/api/auth/forgot-question') {
      throttle(req, 'forgot-question', 12, 60000);
      const body = await jsonBody(req);
      const username = text(body.username) ? body.username.trim().normalize('NFKC') : '';
      if (username.length < 2 || username.length > 20) throw error(400, 'invalid_username', 'Enter a valid username.');
      const account = findUser.get(username.toLowerCase());
      // 不泄露账户是否存在：无密保时也返回空问题
      return sendJson(res, 200, { question: account?.question || '' });
    }
    if (method === 'POST' && route === '/api/auth/forgot-reset') {
      const body = await jsonBody(req);
      const username = text(body.username) ? body.username.trim().normalize('NFKC') : '';
      const usernameKey = username.toLowerCase();
      throttle(req, 'forgot-reset', 8, 60000, usernameKey);
      const answer = text(body.answer) ? String(body.answer) : '';
      const newPassword = text(body.password) ? String(body.password) : '';
      if (!username || !/^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Han}0-9_]{2,20}$/u.test(username)) throw error(400, 'invalid_username', 'Enter a valid username.');
      if (!managedPasswordRule(newPassword)) throw error(400, 'invalid_password', 'The new password must contain 6–128 characters, including a letter and a digit.');
      const account = findUser.get(usernameKey);
      if (!account || !account.question) throw error(404, 'no_question', 'This account has no security question set.');
      const got = await passwordHash(answer, account.salt + ':q');
      const wanted = Buffer.from(account.answer_hash, 'hex');
      if (!timingSafeEqual(got, wanted)) throw error(401, 'invalid_answer', 'The security answer is incorrect.');
      const newHash = (await passwordHash(newPassword, account.salt)).toString('hex');
      setPasswordHash.run(newHash, account.id);
      clearUserSessions.run(account.id);
      return sendJson(res, 200, { ok: true });
    }
    if (method === 'POST' && route === '/api/admin/login') {
      throttle(req, 'admin-login', 12, 15 * 60000);
      const body = await jsonBody(req);
      const input = text(body.password) && body.password.length <= 1024 ? body.password : '';
      const uname = text(body.username) ? body.username.trim().normalize('NFKC').toLowerCase() : '';
      // 方式一：创作者授权的管理员账号（如 小柚子）用自己的账号密码登录
      let accountOk = false;
      if (uname && isAdminUsername(uname)) {
        const acc = findUser.get(uname);
        if (acc && !acc.blocked && input.length >= 1 && input.length <= 128) {
          const got = await passwordHash(input, acc.salt);
          const wanted = Buffer.from(acc.password_hash, 'hex');
          if (timingSafeEqual(got, wanted)) accountOk = true;
        }
      }
      // 方式二：部署者设置的管理密码
      if (!accountOk && !timingSafeEqual(sha(input), adminDigest)) {
        throw error(401, 'invalid_credentials', 'Administrator credentials are incorrect.');
      }
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': issueSession(req, 'admin') });
    }
    if (method === 'POST' && ['/api/auth/logout','/api/admin/logout'].includes(route)) {
      await jsonBody(req);
      const role = route.startsWith('/api/admin/') ? 'admin' : 'user';
      const key = keyForCookie(req, role, hashToken);
      if (key) delSession.run(key, role);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(role, '', secure, true) });
    }
    if (method === 'POST' && route === '/api/auth/heartbeat') {
      const u = session(req, 'user');
      await jsonBody(req);
      const now = Date.now();
      if (!touchSession.run(now, u.token_hash, now).changes) throw error(401, 'unauthorized', 'Sign in to continue.');
      return sendJson(res, 200, { ok: true, user: publicUser(getUser.get(u.user_id), now, isAdminUsername) });
    }
    if (method === 'PUT' && route === '/api/admin/whitelist') {
      session(req, 'admin');
      const body = await jsonBody(req);
      if (!text(body.userId) || body.userId.length > 80 || typeof body.whitelisted !== 'boolean') throw error(400, 'invalid_whitelist', 'Provide a user ID and a true or false authorization value.');
      if (!updateWhitelist.run(Number(body.whitelisted), body.userId).changes) throw error(404, 'user_not_found', 'User not found.');
      return sendJson(res, 200, { user: publicUser(getUser.get(body.userId), Date.now(), isAdminUsername) });
    }
    if (method === 'PUT' && route === '/api/admin/blacklist') {
      session(req, 'admin');
      const body = await jsonBody(req);
      if (!text(body.userId) || body.userId.length > 80 || typeof body.blocked !== 'boolean') throw error(400, 'invalid_blacklist', 'Provide a user ID and a true or false blocked value.');
      const target = getUser.get(body.userId);
      if (!target) throw error(404, 'user_not_found', 'User not found.');
      // 创作者授权的管理员账号与白名单账号受保护，不能被拉黑
      if (body.blocked && (target.whitelisted || isAdminUsername(target.username_key))) {
        throw error(403, 'admin_protected', 'Creator-authorized administrator accounts cannot be blocked.');
      }
      if (!updateBlacklist.run(Number(body.blocked), body.userId).changes) throw error(404, 'user_not_found', 'User not found.');
      if (body.blocked) clearUserSessions.run(body.userId); // 拉黑后立即强制下线
      return sendJson(res, 200, { user: publicUser(getUser.get(body.userId), Date.now(), isAdminUsername) });
    }
    if (method === 'POST' && route === '/api/admin/payments') {
      session(req, 'admin');
      return sendJson(res, 201, { payment: captureReceipt(await jsonBody(req)) });
    }
    throw error(404, 'not_found', 'Not found.');
  }
  const server = createServer({ requestTimeout: 15000, headersTimeout: 10000, maxHeaderSize: 8192 }, async (req, res) => {
    const common = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN' };
    for (const [k, v] of Object.entries(common)) res.setHeader(k, v);
    try {
      if (typeof req.url !== 'string' || !req.url.startsWith('/') || req.url.startsWith('//')) throw error(400, 'invalid_url', 'Invalid URL.');
      const url = new URL(req.url, 'http://local.invalid');
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return await api(req, res, url);
      const asset = ASSETS.get(url.pathname);
      if (!asset || !['GET','HEAD'].includes(req.method)) throw error(404, 'not_found', 'Not found.');
      let bytes;
      try { bytes = await readFile(join(ROOT, asset[0])); }
      catch (e) { if (e.code === 'ENOENT') throw error(404, 'not_found', 'Not found.'); throw e; }
      const admin = ['admin.html','js/admin.js','css/admin.css'].includes(asset[0]);
      if (admin) {
        res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      }
      res.writeHead(200, { 'Content-Type': asset[1], 'Content-Length': bytes.length,
        'Cache-Control': admin ? 'no-store' : 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (e) {
      if (res.headersSent) return res.end();
      if (!e.status) console.error('Request failed:', e.code || e.name);
      sendJson(res, e.status || 500, { error: e.status ? e.message : 'Server error.', code: e.status ? e.code : 'server_error' });
    }
  });
  server.on('close', () => db.close());
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.XIAOXING_HOST || '127.0.0.1';
  const port = Number(process.env.XIAOXING_PORT || 8767);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('XIAOXING_PORT must be a valid TCP port.');
  if (!['localhost','127.0.0.1','::1'].includes(host) && !process.env.XIAOXING_PUBLIC_ORIGIN?.startsWith('https://')) {
    throw new Error('Binding beyond loopback requires XIAOXING_PUBLIC_ORIGIN=https://… behind an HTTPS reverse proxy.');
  }
  const server = await createXiaoxingServer();
  server.listen(port, host, () => console.log(`Xiaoxing managed server listening on ${host}:${port}`));
}
