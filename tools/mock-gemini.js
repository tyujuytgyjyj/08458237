#!/usr/bin/env node
'use strict';
/* خادم Gemini تجريبي متوافق مع OpenAI — للتطوير بلا إنترنت.
   التشغيل: npm run mock:gemini   ثم ضع عنوان الخادم في إعدادات الواجهة القديمة. */
const http = require('node:http');

const PORT = Number(process.env.MOCK_PORT) || 9680;
const HOST = process.env.MOCK_HOST || '127.0.0.1';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function lastUserText(body) {
  const msgs = Array.isArray(body?.messages) ? body.messages : [];
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    if (msgs[i].role !== 'user') continue;
    const c = msgs[i].content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.filter((p) => p.type === 'text').map((p) => p.text).join(' ');
  }
  return '';
}

function answerFor(text) {
  const q = String(text || '').trim().slice(0, 140);
  return [
    'أهلًا بك في **Cosmos** 👋',
    '',
    'هذا خادم محلي تجريبي (Mock) يعمل بلا إنترنت، ويحاكي واجهة OpenAI. ',
    q ? `رسالتك كانت: «${q}».` : '',
    '',
    'عند توصيل مفتاح Gemini الحقيقي في ملف `.env` ستحصل على ردود النموذج الفعلية بنفس الواجهة.',
    '',
    '```js',
    'const reply = await cosmos.chat("مرحبًا");',
    'console.log(reply);',
    '```',
    '',
    '> جرّب إرفاق صورة أو ملف نصي، أو استخدم `/reset-session` لبدء جلسة جديدة.',
  ].filter(Boolean).join('\n');
}

function sendJson(res, status, data) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET' && (req.url === '/v1/models' || req.url === '/api/models')) {
    return sendJson(res, 200, {
      object: 'list',
      data: [
        { id: 'deepseek-chat', object: 'model', owned_by: 'cosmos-mock' },
        { id: 'deepseek-flash', object: 'model', owned_by: 'cosmos-mock' },
      ],
    });
  }
  if (req.method === 'POST' && req.url.startsWith('/reset-session')) {
    return sendJson(res, 200, { ok: true, agent: 'all', stateless: true });
  }
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/api/health')) {
    return sendJson(res, 200, { ok: true, mock: true });
  }
  if (req.method !== 'POST' || !/^\/(v1|api)\/(chat\/completions|chat)/.test(req.url)) {
    return sendJson(res, 404, { error: { message: 'not_found', type: 'invalid_request_error' } });
  }
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 12 * 1024 * 1024) req.destroy();
  });
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { return sendJson(res, 400, { error: { message: 'invalid_json' } }); }
    const id = 'chatcmpl-mock-' + Date.now().toString(36);
    const text = answerFor(lastUserText(body));
    const usage = {
      prompt_tokens: Math.max(8, Math.ceil(lastUserText(body).length / 4)),
      completion_tokens: Math.ceil(text.length / 4),
      total_tokens: 0,
    };
    usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
    if (!body.stream) {
      return sendJson(res, 200, {
        id, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: body.model || 'cosmos-mock',
        choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
        usage,
      });
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const chunk = (delta, finish = null) => {
      res.write('data: ' + JSON.stringify({
        id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: body.model || 'cosmos-mock',
        choices: [{ index: 0, delta, finish_reason: finish }],
      }) + '\n\n');
    };
    chunk({ role: 'assistant', content: '' });
    let i = 0;
    const timer = setInterval(() => {
      if (i >= text.length) {
        clearInterval(timer);
        res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage }) + '\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      const piece = text.slice(i, i + 9);
      i += 9;
      chunk({ content: piece });
    }, 18);
    res.on('close', () => clearInterval(timer));
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n  محاكاة التطوير (ليست خدمة Photon) → http://${HOST}:${PORT}\n  POST /v1/chat/completions (stream supported)\n  POST /reset-session · GET /v1/models\n`);
});
