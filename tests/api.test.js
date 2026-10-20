'use strict';
/* اختبارات تكامل حقيقية: تُشغّل خادمًا مؤقتًا على منفذ منفصل مع تخزين مؤقت. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = Number(process.env.TEST_PORT) || 4319;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(__dirname, '..');
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmos-test-'));
const cookies = new Map();
let child = null;
let csrf = '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function jar() {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}
function absorb(res) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const raw of list) {
    const pair = raw.split(';')[0];
    const i = pair.indexOf('=');
    if (i > 0) cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
async function req(pathname, { method = 'GET', body, headers = {}, csrf: wantCsrf = true } = {}) {
  const h = { ...headers };
  if (cookies.size) h.cookie = jar();
  if (wantCsrf && csrf) h['x-csrf-token'] = csrf;
  if (body !== undefined) h['content-type'] = 'application/json';
  const res = await fetch(BASE + pathname, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  absorb(res);
  return res;
}

before(async () => {
  child = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(PORT),
      HOST: '127.0.0.1',
      STORAGE_DIR: DIR,
      AI_PROVIDER: 'mock',
      DEMO_MODE: 'true',
      ENABLE_SECURE_COOKIES: 'false',
      ANTI_CLI_DISABLE: 'true',
      ENFORCE_CAPTCHA: 'false',
      SESSION_SECRET: 'test-session-secret-0123456789abcdef0123456789abcd',
      CSRF_TOKEN_SECRET: 'test-csrf-secret-0123456789abcdef0123456789abcd',
      OAUTH_STATE_SECRET: 'test-oauth-secret-0123456789abcdef0123456789abcd',
      RESTRICTION_ADMIN_SECRET: 'test-admin-secret-123',
      ADMIN_ENABLED: 'true',
      EMAIL_ENABLED: 'false',
      FREE_DAILY_MESSAGES: '1000',
      GUEST_DAILY_MESSAGES: '1000',
      DB_HOST: '',
      REDIS_URL: '',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      MAX_BODY_SIZE: '8mb',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => { if (process.env.DEBUG) process.stderr.write(d); });
  child.stdout.on('data', (d) => { if (process.env.DEBUG) process.stderr.write(d); });
  let ready = false;
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(BASE + '/api/health');
      if (res.ok) { ready = true; break; }
    } catch (_) { /* retry */ }
    await sleep(120);
  }
  if (!ready) throw new Error('تعذّر تشغيل الخادم التجريبي');
});

after(async () => {
  if (child) {
    child.kill('SIGTERM');
    await sleep(500);
    try { child.kill('SIGKILL'); } catch (_) { /* ignore */ }
    child.unref();
  }
  fs.rmSync(DIR, { recursive: true, force: true });
});

test('health + status', async () => {
  const health = await req('/api/health');
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);
  const status = await req('/api/status');
  const body = await status.json();
  assert.equal(body.ok, true);
  assert.equal(body.ai.demo, true);
  assert.ok(body.ai.models.length >= 2);
  assert.ok(body.features.emailLogin);
});

test('me: guest session + CSRF', async () => {
  const res = await req('/api/me', { csrf: false });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.guest, true);
  assert.match(body.csrf, /^[A-Za-z0-9_-]{16,}$/);
  assert.ok(cookies.has('cosmos_sid'));
  assert.ok(cookies.has('cosmos_csrf'));
  csrf = body.csrf;
});

test('OpenAI-compatible endpoint works without cookies (original HTML)', async () => {
  const res = await fetch(BASE + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'null' },
    body: JSON.stringify({ model: 'deepseek-chat', stream: false, messages: [{ role: 'user', content: 'مرحبًا' }] }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.choices[0].message.content.length > 10);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
});

test('streaming chat with session + CSRF', async () => {
  const res = await req('/v1/chat/completions', {
    method: 'POST',
    body: { model: 'cosmos-blazar-3', stream: true, messages: [{ role: 'user', content: 'اكتب فقرة قصيرة' }] },
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/event-stream/);
  const text = await res.text();
  assert.ok(text.includes('chat.completion.chunk'));
  assert.ok(text.includes('[DONE]'));
  const pieces = text.split('\n').filter((l) => l.startsWith('data: {')).map((l) => JSON.parse(l.slice(6)));
  assert.ok(pieces.length >= 2);
});

test('CSRF protection stays on for cookie clients', async () => {
  const res = await req('/v1/chat/completions', {
    method: 'POST',
    csrf: false,
    body: { model: 'cosmos-photon-3', messages: [{ role: 'user', content: 'اختبار' }] },
  });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.error.code, 'csrf');
});

test('chat CRUD', async () => {
  const put = await req('/api/chats/test-chat-1', {
    method: 'PUT',
    body: { title: 'محادثة اختبار', model: 'cosmos-blazar-3', msgs: [{ r: 'u', c: 'مرحبا' }, { r: 'a', c: 'أهلًا بك' }] },
  });
  assert.equal(put.status, 200);
  const list = await (await req('/api/chats')).json();
  assert.equal(list.chats.length, 1);
  const one = await (await req('/api/chats/test-chat-1')).json();
  assert.equal(one.chat.title, 'محادثة اختبار');
  const del = await req('/api/chats/test-chat-1', { method: 'DELETE' });
  assert.equal(del.status, 200);
  assert.equal((await (await req('/api/chats')).json()).chats.length, 0);
});

test('usage endpoint', async () => {
  const res = await req('/api/usage');
  const body = await res.json();
  assert.ok(body.used >= 1);
  assert.equal(body.limit, 1000);
});

test('images (demo fallback)', async () => {
  const res = await req('/api/images', { method: 'POST', body: { prompt: 'مدينة عند الغروب' } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.match(body.image, /^data:image\/svg\+xml;base64,/);
});

test('feedback', async () => {
  const res = await req('/api/feedback', { method: 'POST', body: { message: 'ملاحظة تجريبية' } });
  const body = await res.json();
  assert.equal(body.ok, true);
});

test('reset-session (no CSRF required)', async () => {
  const res = await fetch(BASE + '/reset-session?agent=all', { method: 'POST' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
});

test('email login (demo code) + admin plan/disable + delete account', async () => {
  const email = `trial-${Date.now()}@example.com`;
  const start = await req('/api/auth/email/start', { method: 'POST', body: { email } });
  assert.equal(start.status, 200);
  const started = await start.json();
  assert.equal(started.delivery, 'demo');
  assert.match(started.devCode, /^\d{6}$/);
  const verify = await req('/api/auth/email/verify', { method: 'POST', body: { email, code: started.devCode } });
  assert.equal(verify.status, 200);
  const verified = await verify.json();
  assert.equal(verified.user.email, email);
  const userId = verified.user.id;

  let me = await (await req('/api/me', { csrf: false })).json();
  csrf = me.csrf;
  assert.equal(me.user.id, userId);
  assert.equal(me.plan, 'free');

  const planRes = await fetch(`${BASE}/api/admin/users/${userId}/plan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-secret': 'test-admin-secret-123' },
    body: JSON.stringify({ plan: 'premium' }),
  });
  assert.equal(planRes.status, 200);
  me = await (await req('/api/me', { csrf: false })).json();
  csrf = me.csrf;
  assert.equal(me.plan, 'premium');

  const disableRes = await fetch(`${BASE}/api/admin/users/${userId}/disable`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-secret': 'test-admin-secret-123' },
    body: JSON.stringify({ disabled: true, reason: 'اختبار' }),
  });
  assert.equal(disableRes.status, 200);
  me = await (await req('/api/me', { csrf: false })).json();
  csrf = me.csrf;
  assert.equal(me.accountDisabled, true);
  assert.equal(me.user, null);

  await fetch(`${BASE}/api/admin/users/${userId}/disable`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-secret': 'test-admin-secret-123' },
    body: JSON.stringify({ disabled: false }),
  });
  me = await (await req('/api/me', { csrf: false })).json();
  csrf = me.csrf;
  assert.equal(me.user.id, userId);

  const del = await req('/api/account/delete', { method: 'POST', body: { confirm: 'DELETE' } });
  assert.equal(del.status, 200);
  me = await (await req('/api/me', { csrf: false })).json();
  csrf = me.csrf;
  assert.equal(me.guest, true);
});

test('admin: auth, overview, CSV, page', async () => {
  const denied = await fetch(BASE + '/api/admin/overview');
  assert.equal(denied.status, 401);
  const overview = await fetch(BASE + '/api/admin/overview', { headers: { 'x-admin-secret': 'test-admin-secret-123' } });
  assert.equal(overview.status, 200);
  const body = await overview.json();
  assert.equal(body.ok, true);
  assert.ok(body.storage.driver);
  const csv = await fetch(BASE + '/api/admin/export/users.csv', { headers: { 'x-admin-secret': 'test-admin-secret-123' } });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  const page = await fetch(BASE + '/admin');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /لوحة إدارة Cosmos/);
});

test('settings page + security headers', async () => {
  const res = await fetch(BASE + '/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(res.headers.get('x-frame-options'), null); // ضروري لمعاينة iframe
  const js = await fetch(BASE + '/assets/app.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);
});
