'use strict';
/**
 * خدمة نماذج محلية للتطوير والاختبار فقط.
 * تتحدث بصيغة OpenAI (chat/completions + reset-session + models)
 * وتُستخدم للتحقق من مسار Cosmos Photon 3 دون الحاجة لخدمة خارجية.
 *
 * التشغيل: node tools/local-model-service.js --port 9655
 */

const http = require('node:http');

const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = Number(portArg >= 0 ? args[portArg + 1] : process.env.LOCAL_MODEL_PORT || process.env.MOCK_PORT) || 9655;
const HOST = process.env.LOCAL_MODEL_HOST || '127.0.0.1';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function lastUserText(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role !== 'user') continue;
    const content = messages[i].content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.filter((p) => p.type === 'text').map((p) => p.text).join(' ');
  }
  return '';
}

function answerFor(text) {
  const q = String(text || '').trim().slice(0, 120);
  return [
    'خدمة النماذج المحلية تعمل.',
    '',
    q ? `استُلمت رسالتك: «${q}».` : '',
    '',
    'هذه خدمة تطوير محلية تُحاكي واجهة OpenAI، وتُستخدم للتحقق من مسار Cosmos Photon 3 فقط.',
  ].filter(Boolean).join('\n');
}

function json(res, status, data) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET' && (req.url === '/v1/models' || req.url === '/api/models')) {
    return json(res, 200, {
      object: 'list',
      data: [
        { id: 'deepseek-chat', object: 'model', owned_by: 'local' },
        { id: 'deepseek-flash', object: 'model', owned_by: 'local' },
      ],
    });
  }
  if (req.method === 'POST' && req.url.startsWith('/reset-session')) {
    return json(res, 200, { ok: true, agent: 'all', stateless: true });
  }
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/api/health')) {
    return json(res, 200, { ok: true, local: true });
  }
  if (req.method !== 'POST' || !/^\/(v1|api)\/(chat\/completions|chat)/.test(req.url)) {
    return json(res, 404, { error: { message: 'not_found', type: 'invalid_request_error' } });
  }
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 12 * 1024 * 1024) req.destroy();
  });
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { return json(res, 400, { error: { message: 'invalid_json' } }); }
    const id = 'chatcmpl-local-' + Date.now().toString(36);
    const text = answerFor(lastUserText(body));
    const usage = {
      prompt_tokens: Math.max(8, Math.ceil(lastUserText(body).length / 4)),
      completion_tokens: Math.ceil(text.length / 4),
    };
    usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
    if (!body.stream) {
      return json(res, 200, {
        id,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model || 'deepseek-chat',
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
        id,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: body.model || 'deepseek-chat',
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
      chunk({ content: text.slice(i, i + 8) });
      i += 8;
    }, 12);
    res.on('close', () => clearInterval(timer));
  });
});

server.listen(PORT, HOST, () => {
  console.log(`  Local model service → http://${HOST}:${PORT}`);
});
