'use strict';

/**
 * اختبارات توجيه النماذج:
 * Cosmos Blazar 3 → خدمة Blazar المهيأة (Gemini-format)
 * Cosmos Photon 3 → خدمة Photon المحلية (OpenAI-format)
 * ولا يوجد أي مسار مشترك بينهما.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const APP_PORT = Number(process.env.ROUTING_TEST_PORT) || 4321;
const GEMINI_PORT = 41230;
const PHOTON_PORT = 41231;
const BASE = `http://127.0.0.1:${APP_PORT}`;
const ROOT = path.resolve(__dirname, '..');
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmos-routing-'));

const hits = { gemini: [], photon: [] };
const cookies = new Map();
let csrf = '';
let app = null;
let geminiServer = null;
let photonServer = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------- خدمات وهمية ----------------------------- */

function listen(server, port) {
  return new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
}

function close(server) {
  return new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
    setTimeout(resolve, 800).unref?.();
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => resolve(raw));
  });
}

function createGeminiStub() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const match = url.pathname.match(/\/models\/([^:]+):(\w+)/);
    if (!match) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end('{"error":{"message":"not found"}}');
    }
    const model = decodeURIComponent(match[1]);
    const action = match[2];
    const body = await readBody(req);
    hits.gemini.push({ model, action, body: body ? JSON.parse(body) : null });
    const text = 'رد من مسار Blazar التجريبي.';
    if (action === 'generateContent') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 7, totalTokenCount: 12 },
      }));
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const piece of text.match(/[\s\S]{1,6}/g)) {
      res.write('data: ' + JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: piece }] } }] }) + '\r\n\r\n');
    }
    res.write('data: ' + JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: '' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 7, totalTokenCount: 12 } }) + '\r\n\r\n');
    res.end();
  });
}

function createPhotonStub() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ object: 'list', data: [{ id: 'deepseek-chat' }, { id: 'deepseek-flash' }] }));
    }
    if (req.method === 'POST' && url.pathname === '/reset-session') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{"ok":true}');
    }
    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      const body = JSON.parse((await readBody(req)) || '{}');
      hits.photon.push(body);
      const text = 'رد من مسار Photon التجريبي.';
      if (!body.stream) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          id: 'chatcmpl-stub',
          object: 'chat.completion',
          model: body.model,
          choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 },
        }));
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      for (const piece of text.match(/[\s\S]{1,5}/g)) {
        res.write('data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content: piece } }] }) + '\n\n');
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{"error":{"message":"not found"}}');
  });
}

/* --------------------------------- أدوات --------------------------------- */

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

async function api(pathname, { method = 'GET', body, headers = {}, csrf: wantCsrf = true } = {}) {
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

async function chat(model, extra = {}) {
  const res = await api('/v1/chat/completions', {
    method: 'POST',
    body: { model, messages: [{ role: 'user', content: 'اختبار التوجيه' }], stream: true, ...extra },
  });
  if (process.env.DEBUG_CHAT) {
    const copy = await res.clone().text();
    console.error(`[chat ${model}] ${res.status} :: ${copy.slice(0, 400)}`);
  }
  return res;
}

function parseStream(text) {
  return text.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).filter((l) => l !== '[DONE]').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

const leakPattern = /gemini|gemma|deepseek|127\.0\.0\.1|localhost|9655|41230|41231|googleapis/i;

before(async () => {
  geminiServer = createGeminiStub();
  photonServer = createPhotonStub();
  await listen(geminiServer, GEMINI_PORT);
  await listen(photonServer, PHOTON_PORT);

  app = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(APP_PORT),
      HOST: '127.0.0.1',
      STORAGE_DIR: DIR,
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'test-gemini-key',
      GEMINI_BASE_URL: `http://127.0.0.1:${GEMINI_PORT}`,
      GEMINI_MODEL: 'gemma-test-blazar',
      GEMINI_FALLBACK_MODEL: '',
      GEMINI_VISION_MODEL: 'gemma-test-blazar',
      GEMINI_IMAGE_MODEL: '',
      DEMO_FALLBACK: 'false',
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${PHOTON_PORT}`,
      DEEPSEEK_MODEL: 'deepseek-chat',
      DEEPSEEK_VISION_MODEL: 'deepseek-flash',
      DEEPSEEK_RESET_SESSION: 'true',
      DEEPSEEK_AUTOSTART: 'false',
      DEMO_MODE: 'true',
      ENABLE_SECURE_COOKIES: 'false',
      ANTI_CLI_DISABLE: 'true',
      EMAIL_ENABLED: 'false',
      SESSION_SECRET: 'routing-session-secret-0123456789abcdef0123456789',
      CSRF_TOKEN_SECRET: 'routing-csrf-secret-0123456789abcdef0123456789ab',
      RESTRICTION_ADMIN_SECRET: 'routing-admin-secret',
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
  app.stderr.on('data', (d) => { if (process.env.DEBUG) process.stderr.write(d); });
  app.stdout.on('data', (d) => { if (process.env.DEBUG) process.stderr.write(d); });

  let ready = false;
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(BASE + '/api/health');
      if (res.ok) { ready = true; break; }
    } catch { /* retry */ }
    await sleep(120);
  }
  if (!ready) throw new Error('تعذّر تشغيل خادم الاختبار');

  const me = await (await api('/api/me', { csrf: false })).json();
  csrf = me.csrf;
});

after(async () => {
  if (app) { app.kill('SIGTERM'); await sleep(400); try { app.kill('SIGKILL'); } catch { /* ignore */ } app.unref(); }
  await close(geminiServer);
  await close(photonServer);
  fs.rmSync(DIR, { recursive: true, force: true });
});

/* -------------------------------- الاختبارات ------------------------------- */

test('قائمة النماذج تعرض أسماء المنتج فقط', async () => {
  const res = await api('/api/models', { csrf: false });
  assert.equal(res.status, 200);
  const body = await res.json();
  const ids = body.data.map((m) => m.id);
  assert.deepEqual(ids, ['cosmos-blazar-3', 'cosmos-photon-3']);
  for (const model of body.data) {
    assert.equal(model.label.startsWith('Cosmos '), true);
    assert.equal('upstream' in model, false);
    assert.equal('provider' in model, false);
  }
  assert.equal('provider' in body, false);
  const raw = JSON.stringify(body);
  assert.equal(leakPattern.test(raw), false, 'تسريب مزوّد في /api/models: ' + raw);

  const v1 = await (await api('/v1/models', { csrf: false })).json();
  assert.deepEqual(v1.data.map((m) => m.id), ['cosmos-blazar-3', 'cosmos-photon-3']);
  assert.equal(leakPattern.test(JSON.stringify(v1)), false);
});

test('Blazar 3 يصل إلى خدمة Blazar ولا يلمس خدمة Photon', async () => {
  const beforeGemini = hits.gemini.length;
  const beforePhoton = hits.photon.length;
  const res = await chat('cosmos-blazar-3');
  assert.equal(res.status, 200);
  const text = await res.text();
  const events = parseStream(text);
  assert.ok(events.length >= 2);
  assert.equal(events[events.length - 1].model, 'cosmos-blazar-3');
  const content = events.map((e) => e.choices?.[0]?.delta?.content || '').join('');
  assert.match(content, /Blazar/);

  assert.equal(hits.gemini.length, beforeGemini + 1, 'يجب أن يصل الطلب إلى خدمة Blazar');
  assert.equal(hits.gemini[hits.gemini.length - 1].model, 'gemma-test-blazar');
  assert.equal(hits.photon.length, beforePhoton, 'يجب ألا يصل الطلب إلى خدمة Photon');
  assert.equal(leakPattern.test(text), false, 'تسريب بيانات مزوّد في بث Blazar');
});

test('Photon 3 يصل إلى خدمة Photon المحلية ولا يلمس خدمة Blazar', async () => {
  const beforeGemini = hits.gemini.length;
  const beforePhoton = hits.photon.length;
  const res = await chat('cosmos-photon-3');
  assert.equal(res.status, 200);
  const text = await res.text();
  const events = parseStream(text);
  assert.ok(events.length >= 2);
  assert.equal(events[events.length - 1].model, 'cosmos-photon-3');
  const content = events.map((e) => e.choices?.[0]?.delta?.content || '').join('');
  assert.match(content, /Photon/);

  assert.equal(hits.photon.length, beforePhoton + 1, 'يجب أن يصل الطلب إلى خدمة Photon');
  assert.equal(hits.photon[hits.photon.length - 1].model, 'deepseek-chat');
  assert.equal(hits.gemini.length, beforeGemini, 'يجب ألا يصل طلب Photon إلى خدمة Blazar');
  assert.equal(leakPattern.test(text), false, 'تسريب بيانات مزوّد في بث Photon');
});

test('Photon 3 يستخدم نموذج الرؤية عند إرفاق صورة', async () => {
  const beforePhoton = hits.photon.length;
  const res = await chat('cosmos-photon-3', {
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'ما في الصورة؟' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' } },
      ],
    }],
  });
  assert.equal(res.status, 200);
  await res.text();
  assert.equal(hits.photon.length, beforePhoton + 1);
  assert.equal(hits.photon[hits.photon.length - 1].model, 'deepseek-flash');
});

test('Photon 3 بدون بث (JSON) يصل إلى الخدمة نفسها', async () => {
  const beforePhoton = hits.photon.length;
  const res = await api('/v1/chat/completions', {
    method: 'POST',
    body: { model: 'cosmos-photon-3', stream: false, messages: [{ role: 'user', content: 'اختبار' }] },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.model, 'cosmos-photon-3');
  assert.match(body.choices[0].message.content, /Photon/);
  assert.equal(hits.photon.length, beforePhoton + 1);
  assert.equal(leakPattern.test(JSON.stringify(body)), false);
});

test('Photon 3 يعيد خطأ توفر واضحًا عند تعطّل الخدمة دون التحول إلى Blazar', async () => {
  await close(photonServer);
  photonServer = null;
  await sleep(200);

  const res = await api('/v1/chat/completions', {
    method: 'POST',
    body: { model: 'cosmos-photon-3', messages: [{ role: 'user', content: 'هل تعمل؟' }] },
  });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error.code, 'photon_unavailable');
  assert.match(body.error.message, /Cosmos Photon 3/);
  assert.match(body.error.message, /غير متاح/);
  assert.equal(leakPattern.test(JSON.stringify(body)), false, 'الخطأ يجب ألا يكشف العنوان أو المزوّد');

  const geminiBefore = hits.gemini.length;
  const ok = await chat('cosmos-blazar-3');
  assert.equal(ok.status, 200);
  await ok.text();
  assert.equal(hits.gemini.length, geminiBefore + 1, 'Blazar يجب أن يظل يعمل');
  assert.equal(hits.photon.length > 0, true);
});

test('استجابة فشل Photon في البث لا تذكر أي مزوّد أو عنوان', async () => {
  const res = await chat('cosmos-photon-3');
  assert.equal(res.status, 503);
  const text = await res.text();
  assert.match(text, /photon_unavailable/);
  assert.equal(leakPattern.test(text), false);
});

test('الحالة العامة تعرض حالة النماذج بلا تفاصيل داخلية', async () => {
  const status = await (await api('/api/status', { csrf: false })).json();
  assert.equal(status.ok, true);
  assert.equal(Array.isArray(status.ai.models), true);
  assert.equal(status.ai.models.length, 2);
  assert.equal(status.ai.models.find((m) => m.id === 'cosmos-photon-3').available, false);
  assert.equal(leakPattern.test(JSON.stringify(status)), false, 'تسريب في /api/status');

  const me = await (await api('/api/me', { csrf: false })).json();
  csrf = me.csrf;
  assert.equal(leakPattern.test(JSON.stringify(me)), false, 'تسريب في /api/me');

  const health = await (await api('/api/health', { csrf: false })).json();
  assert.equal(leakPattern.test(JSON.stringify(health)), false, 'تسريب في /api/health');
});

test('لوحة الإدارة تعرض تشخيص Photon دون كشف العنوان', async () => {
  const res = await fetch(BASE + '/api/diagnostics', { headers: { 'x-admin-secret': 'routing-admin-secret' } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.photon.configured, true);
  assert.equal(body.photon.available, false);
  assert.equal(body.photon.lastError !== null, true);
  assert.equal(body.photon.endpoint.scope, 'local');
  assert.equal(JSON.stringify(body.photon).includes('127.0.0.1'), false);
  assert.equal(JSON.stringify(body.photon).includes('deepseek'), false);
  assert.equal(leakPattern.test(JSON.stringify(body.photon)), false, 'تشخيص الإدارة يجب ألا يكشف العنوان أو المنفذ');
});
