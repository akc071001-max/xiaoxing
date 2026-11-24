const el = (id) => document.getElementById(id);
const CNY = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' });
const INTEGER = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
const DATE = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
const selections = new Set(['7', '30', '90', 'all']);
let snapshot = null;
let reloadGeneration = 0;
let signedIn = false;
let busy = false;

function parseCents(value) {
  const match = String(value).trim().match(/^(\d{1,10})(?:[.,](\d{1,2}))?$/);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
function integer(value) {
  return Number.isSafeInteger(value) && value >= 0 ? INTEGER.format(value) : '—';
}
function money(value) {
  return Number.isSafeInteger(value) ? CNY.format(value / 100) : '—';
}
function dateLabel(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '—';
  const d = new Date(value);
  return Number.isFinite(d.valueOf()) ? DATE.format(d) : '—';
}
function localInputDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-') +
    'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}
function localISO(value) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return null;
  const d = new Date(value);
  return Number.isFinite(d.valueOf()) && localInputDate(d) === value ? d.toISOString() : null;
}
function errorText(err) {
  const code = String(err.code || '').toUpperCase();
  const label = {
    UNAUTHORIZED: '需要重新登录管理控制台。',
    INVALID_CREDENTIALS: '管理密码不正确。',
    INVALID_ADMIN_PASSWORD: '管理密码不正确。',
    DUPLICATE_REFERENCE: '此凭证编号已登记。请核对流水，避免重复计入。',
    REFUND_EXCEEDS_PAYMENT: '退款金额不能超过该账号尚可退款的已登记金额。',
    REFUND_EXCEEDS_PAYMENTS: '退款金额不能超过对应时点的已登记到账金额。',
    REFUND_EXCEEDS_PAID: '退款金额不能超过该账号尚可退款的已登记金额。',
    USER_NOT_FOUND: '该用户不存在。请刷新后重新选择。',
    BAD_REQUEST: '表单数据不符合要求。请检查用户、金额、凭证号和时间。'
  };
  if (label[code]) return label[code];
  if (err.status === 0) return '无法连接管理后端，请检查服务和网络。';
  if (err.status === 401) return '管理密码不正确，或登录已过期。';
  if (err.status === 403) return '请求未获授权。请重新打开控制台后再试。';
  if (err.status === 409) return '记录发生冲突，请检查凭证编号或已登记金额。';
  if (err.status === 429) return '请求过多，请稍后再试。';
  if (err.status === 503) return '管理端尚未配置，或暂时不可用。请联系部署者。';
  if (err.status === 404) return '没有找到管理后端或对应记录。请确认使用的是带服务端的部署地址。';
  if (err.status === 400 || err.status === 422) return '表单数据不符合要求。请检查用户、金额、凭证号和时间。';
  return '操作未完成，请稍后重试。';
}
function setStatus(id, text = '', tone = '') {
  const node = el(id);
  node.textContent = text;
  node.dataset.tone = tone;
}
async function api(path, method = 'GET', payload) {
  const options = { method, cache: 'no-store', credentials: 'same-origin' };
  if (method !== 'GET') {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(payload || {});
  }
  let response;
  try { response = await fetch(path, options); }
  catch (cause) { throw Object.assign(new Error('Network unavailable', { cause }), { status: 0 }); }
  const type = response.headers.get('Content-Type') || '';
  const data = type.includes('application/json') ? await response.json().catch(() => null) : null;
  if (!response.ok || (method === 'GET' && (!data || typeof data !== 'object'))) {
    throw Object.assign(new Error('Request failed'), { status: response.ok ? 404 : response.status,
      code: data && typeof data.code === 'string' ? data.code : '' });
  }
  return data;
}

function addCell(row, value, css = '') {
  const cell = row.insertCell();
  if (value instanceof Node) cell.append(value); else cell.textContent = value;
  if (css) cell.className = css;
  return cell;
}
function makeBadge(text, variant = '') {
  const node = document.createElement('span');
  node.className = 'badge' + (variant ? ' ' + variant : '');
  node.textContent = text;
  return node;
}
function planName(value) {
  return ({ free: '免费', pro: '专业版', flag: '旗舰版', trial: '试用', vip: '会员' })[value] || '—';
}
function showLogin(message = '', focus = true) {
  ++reloadGeneration;
  snapshot = null;
  signedIn = false;
  el('dashboard-view').hidden = true;
  el('login-view').hidden = false;
  setStatus('login-status', message, message ? 'error' : '');
  if (focus) el('admin-password').focus();
}
function showDashboard() {
  if (signedIn) return;
  signedIn = true;
  el('login-view').hidden = true;
  el('dashboard-view').hidden = false;
  el('page-title').focus();
}
function currentPeriod() {
  const period = el('period').value;
  return selections.has(period) ? period : '30';
}
function isHistoricalPayer(user, matchingLedger) {
  return user.hasPaid === true || (user.hasPaid == null && (user.netCents > 0 || matchingLedger.has(String(user.id))));
}
function renderUsers() {
  const body = el('users-body');
  body.replaceChildren();
  if (!snapshot) return;
  const query = el('user-search').value.trim().toLocaleLowerCase();
  const onlyPaid = el('payer-filter').checked;
  const payments = new Set(snapshot.payments.filter((p) => p.kind === 'payment').map((p) => String(p.userId)));
  const users = snapshot.users.filter((u) => String(u.username).toLocaleLowerCase().includes(query) &&
    (!onlyPaid || isHistoricalPayer(u, payments)));
  for (const user of users) {
    const row = body.insertRow();
    if (user.blocked) row.className = 'blocked-row';
    const name = addCell(row, user.username);
    if (user.blocked) name.append(document.createElement('br'), makeBadge('已拉黑', 'blocked'));
    const action = document.createElement('button');
    action.type = 'button';
    action.setAttribute('aria-pressed', String(Boolean(user.whitelisted)));
    action.setAttribute('aria-label', user.username + (user.whitelisted ? '：移出白名单' : '：加入白名单'));
    action.dataset.member = String(Boolean(user.whitelisted));
    action.textContent = user.whitelisted ? '已加入 · 移出' : '加入白名单';
    action.addEventListener('click', async () => {
      action.disabled = true;
      setStatus('dashboard-status', '正在更新白名单…');
      try {
        await api('/api/admin/whitelist', 'PUT', { userId: user.id, whitelisted: !user.whitelisted });
        await reload({ notice: user.username + (user.whitelisted ? ' 已移出白名单。' : ' 已加入白名单。'), preferUser: user.id });
      } catch (err) {
        if (err.status === 401) showLogin(errorText(err));
        else setStatus('dashboard-status', errorText(err), 'error');
      } finally { action.disabled = false; }
    });
    action.dataset.user = String(user.id);
    const block = document.createElement('button');
    block.type = 'button';
    block.className = user.blocked ? 'danger' : '';
    block.setAttribute('aria-pressed', String(Boolean(user.blocked)));
    block.setAttribute('aria-label', user.username + (user.blocked ? '：解除拉黑' : '：拉黑该用户'));
    block.textContent = user.blocked ? '解除拉黑' : '拉黑';
    block.addEventListener('click', async () => {
      block.disabled = true;
      setStatus('dashboard-status', user.blocked ? '正在解除拉黑…' : '正在拉黑…');
      try {
        await api('/api/admin/blacklist', 'PUT', { userId: user.id, blocked: !user.blocked });
        await reload({ notice: user.username + (user.blocked ? ' 已解除拉黑。' : ' 已被拉黑并强制下线。'), preferUser: user.id });
      } catch (err) {
        if (err.status === 401) showLogin(errorText(err));
        else setStatus('dashboard-status', errorText(err), 'error');
      } finally { block.disabled = false; }
    });
    block.dataset.user = String(user.id);
    addCell(row, dateLabel(user.createdAt));
    addCell(row, makeBadge(planName(user.plan)));
    addCell(row, money(user.netCents), 'money');
    const actions = document.createElement('div');
    actions.className = 'user-actions';
    actions.append(action, block);
    addCell(row, actions);
    if (isHistoricalPayer(user, payments)) {
      const label = makeBadge('有充值记录', 'received');
      name.append(document.createElement('br'), label);
    }
  }
  const empty = el('users-empty');
  empty.hidden = users.length !== 0;
  empty.textContent = snapshot.users.length ? '没有匹配的用户。' : '当前还没有在本服务器注册的用户。';
}
function renderLedger() {
  const body = el('ledger-body');
  body.replaceChildren();
  for (const tx of snapshot.payments) {
    const row = body.insertRow();
    addCell(row, dateLabel(tx.occurredAt));
    addCell(row, tx.username || '—');
    addCell(row, makeBadge(tx.kind === 'refund' ? '已退回' : '到账', tx.kind === 'refund' ? 'refund' : 'received'));
    addCell(row, money(tx.amountCents), 'money');
    addCell(row, tx.reference || '—');
    addCell(row, tx.note || '—');
  }
  el('ledger-empty').hidden = snapshot.payments.length > 0;
}
function renderDaily() {
  const body = el('daily-body');
  body.replaceChildren();
  for (const daily of snapshot.daily) {
    const row = body.insertRow();
    addCell(row, daily.date || '—');
    addCell(row, integer(daily.registrations), 'quantity');
    addCell(row, integer(daily.payments), 'quantity');
    addCell(row, integer(daily.refunds), 'quantity');
    addCell(row, money(daily.netCents), 'money');
  }
  el('daily-empty').hidden = snapshot.daily.length > 0;
  const zone = typeof snapshot.timeZone === 'string' && /^[A-Za-z0-9_+\/-]{2,50}$/.test(snapshot.timeZone) ? snapshot.timeZone : 'UTC';
  el('daily-zone').textContent = '日汇总按 ' + zone + ' 划分；流水时间按浏览器所在时区显示。';
}
function renderReceiptUser() {
  const menu = el('receipt-user');
  const previous = menu.value;
  menu.replaceChildren();
  const hint = document.createElement('option');
  hint.value = '';
  hint.textContent = snapshot.users.length ? '请选择用户名' : '暂无可选用户';
  menu.append(hint);
  for (const user of snapshot.users) {
    const option = document.createElement('option');
    option.textContent = user.username;
    option.value = String(user.id);
    menu.append(option);
  }
  if (snapshot.users.some((user) => String(user.id) === previous)) menu.value = previous;
  menu.disabled = !snapshot.users.length;
  el('record-button').disabled = !snapshot.users.length || busy;
}
function renderOnline(online) { el('online-users').textContent = integer(online); }
function renderSnapshot(data) {
  snapshot = { ...data,
    users: Array.isArray(data.users) ? data.users : [],
    payments: Array.isArray(data.payments) ? data.payments : [],
    daily: Array.isArray(data.daily) ? data.daily : []
  };
  for (const [id, key] of Object.entries({
    'total-users': 'totalUsers', 'period-users': 'periodUsers', 'total-payers': 'totalPayers',
    'period-payers': 'periodPayers', 'whitelist-count': 'whitelistCount'
  })) el(id).textContent = integer(data[key]);
  for (const [id, key] of Object.entries({
    'period-gross': 'periodGrossCents', 'period-refunds': 'periodRefundCents', 'period-net': 'periodNetCents'
  })) el(id).textContent = money(data[key]);
  renderOnline(data.onlineUsers);
  renderUsers();
  renderLedger();
  renderDaily();
  renderReceiptUser();
}
async function reload({ silent = false, initial = false, onlineOnly = false, notice = '', preferUser } = {}) {
  const generation = onlineOnly ? reloadGeneration : ++reloadGeneration;
  if (!silent && !onlineOnly) setStatus('dashboard-status', '正在读取实时数据…');
  try {
    const data = await api('/api/admin/dashboard?days=' + currentPeriod());
    if (generation !== reloadGeneration) return;
    if (onlineOnly) {
      if (signedIn) renderOnline(data.onlineUsers);
      return;
    }
    showDashboard();
    renderSnapshot(data);
    setStatus('dashboard-status', notice || '已更新 · ' + dateLabel(Date.now()), 'ok');
    if (preferUser != null) {
      Array.from(el('users-body').querySelectorAll('button[data-user]')).find((b) => b.dataset.user === String(preferUser))?.focus();
    }
  } catch (err) {
    if (generation !== reloadGeneration) return;
    if (err.status === 401) showLogin(initial ? '' : '管理会话已结束，请重新登录。', !initial);
    else if (initial) showLogin(errorText(err), false);
    else if (!onlineOnly) setStatus('dashboard-status', errorText(err), 'error');
    else el('online-users').textContent = '—';
  }
}
async function login(event) {
  event.preventDefault();
  const password = el('admin-password');
  const button = el('login-form').querySelector('button');
  const submitted = password.value;
  if (!submitted || button.disabled) return;
  button.disabled = true;
  setStatus('login-status', '正在登录…');
  try {
    await api('/api/admin/login', 'POST', { password: submitted });
    password.value = '';
    await reload({ initial: true });
  } catch (err) {
    setStatus('login-status', errorText(err), 'error');
    password.value = '';
    password.focus();
  } finally { button.disabled = false; }
}
async function logout() {
  const button = el('logout');
  if (button.disabled) return;
  button.disabled = true;
  try {
    await api('/api/admin/logout', 'POST');
    showLogin();
  } catch (err) {
    if (err.status === 401) showLogin();
    else setStatus('dashboard-status', errorText(err), 'error');
  } finally { button.disabled = false; }
}
async function recordReceipt(event) {
  event.preventDefault();
  if (busy || !snapshot || !el('receipt-confirm').checked) return;
  const user = snapshot.users.find((user) => String(user.id) === el('receipt-user').value);
  const amountCents = parseCents(el('receipt-amount').value);
  const occurredAt = localISO(el('receipt-occurrence').value);
  const reference = el('receipt-reference').value.trim();
  const kind = el('receipt-kind').value;
  if (!user || amountCents === null || !occurredAt || !reference || !['payment', 'refund'].includes(kind)) {
    setStatus('receipt-status', '请选择用户并填写有效的金额、凭证编号和实际交易时间。金额须大于零，最多两位小数。', 'error');
    return;
  }
  busy = true;
  el('record-button').disabled = true;
  setStatus('receipt-status', '正在登记…');
  try {
    await api('/api/admin/payments', 'POST', { userId: user.id, kind, amountCents, reference, occurredAt, note: el('receipt-note').value.trim() });
    el('receipt-amount').value = '';
    el('receipt-reference').value = '';
    el('receipt-note').value = '';
    el('receipt-confirm').checked = false;
    setStatus('receipt-status', (kind === 'refund' ? '退款' : '收款') + '流水已登记：' + money(amountCents) + '。', 'ok');
    await reload({ silent: true });
  } catch (err) {
    if (err.status === 401) showLogin(errorText(err));
    else setStatus('receipt-status', errorText(err), 'error');
  } finally {
    busy = false;
    el('record-button').disabled = !snapshot || !snapshot.users.length;
  }
}
el('login-form').addEventListener('submit', login);
el('logout').addEventListener('click', logout);
el('refresh').addEventListener('click', () => reload());
el('period').addEventListener('change', () => reload());
el('user-search').addEventListener('input', renderUsers);
el('payer-filter').addEventListener('change', renderUsers);
el('receipt-form').addEventListener('submit', recordReceipt);
el('receipt-occurrence').value = localInputDate();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && signedIn) reload({ onlineOnly: true });
});
setInterval(() => {
  if (!document.hidden && signedIn) reload({ onlineOnly: true });
}, 60_000);
reload({ silent: true, initial: true });

