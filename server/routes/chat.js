'use strict';

const express = require('express');
const config = require('../config');
const gemini = require('../lib/gemini');
const photon = require('../lib/photon');
const models = require('../lib/models');
const store = require('../lib/store');
const { chatLimiter } = require('../lib/rate-limit');
const { asyncHandler, openaiError } = require('../lib/http');
const { uid, truncate } = require('../lib/util');
const { logEvent } = require('../lib/events');
const { checkUsage, dailyLimitFor, nextReset } = require('../lib/usage');

const router = express.Router();
const MODES = new Set(['chat', 'code', 'study', 'writing']);
const MAX_MESSAGES = 100;

function badRequest(message, code) {
  return Object.assign(new Error(message), { status: 400, type: 'invalid_request_error', code, expose: true });
}

function estimateBytes(value) {
  try { return Buffer.byteLength(JSON.stringify(value)); } catch { return Infinity; }
}

function normalizeMessages(input) {
  if (!Array.isArray(input) || input.length === 0) throw badRequest('messages مطلوبة ويجب أن تكون مصفوفة غير فارغة', 'messages_required');
  if (input.length > MAX_MESSAGES) throw badRequest(`الحد الأقصى ${MAX_MESSAGES} رسالة في الطلب`, 'too_many_messages');
  if (estimateBytes(input) > 4 * 1024 * 1024) throw badRequest('حجم المحادثة أكبر من المسموح (4MB)', 'payload_too_large');
  const out = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const role = raw.role === 'assistant' ? 'assistant' : raw.role === 'system' ? 'system' : 'user';
    const content = raw.content;
    if (typeof content === 'string') {
      out.push({ role, content: truncate(content, 120_000) });
    } else if (Array.isArray(content)) {
      const parts = content.slice(0, 12).filter((p) => p && (p.type === 'text' || p.type === 'image_url' || p.type === 'file'));
      out.push({ role, content: parts });
    } else if (role === 'assistant' && typeof raw.text === 'string') {
      out.push({ role, content: raw.text });
    }
  }
  if (!out.length) throw badRequest('لا توجد رسائل صالحة', 'empty_messages');
  return out;
}

function selectedMode(req, body) {
  const mode = String(body.mode || req.get('x-cosmos-mode') || 'chat').toLowerCase();
  return MODES.has(mode) ? mode : 'chat';
}

function sseWrite(res, data) {
  if (res.writableEnded) return;
  res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
}

async function handleChat(req, res) {
  if (req.accountDisabled) return openaiError(res, 403, 'هذا الحساب موقوف. تواصل مع الإدارة.', { type: 'account_disabled' });
  const body = req.body || {};
  let messages;
  try {
    messages = normalizeMessages(body.messages);
  } catch (err) {
    return openaiError(res, err.status || 400, err.message, { code: err.code });
  }
  const stream = body.stream === undefined ? req.path === '/api/chat' : Boolean(body.stream);
  const mode = selectedMode(req, body);
  const requestedModel = body.model || 'cosmos-blazar-3';
  const target = models.resolve(requestedModel);
  const model = target.id;
  const runner = target.provider === 'photon' ? photon : gemini;
  const systemFromMessages = messages
    .filter((m) => m.role === 'system' && typeof m.content === 'string')
    .map((m) => m.content)
    .join('\n\n');
  const system = [systemFromMessages, typeof body.system === 'string' ? body.system : '']
    .filter(Boolean).join('\n\n').slice(0, 6000);
  const temperature = Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : 0.7;
  const maxTokens = Math.min(16384, Math.max(256, Number(body.max_tokens || body.maxTokens) || 4096));

  let limits;
  try {
    limits = await checkUsage(req);
  } catch (err) {
    console.error('[usage]', err);
    return openaiError(res, 500, 'تعذّر حساب الاستخدام. حاول لاحقًا.');
  }
  if (limits.limit > 0 && limits.usage.messages >= limits.limit) {
    return res.status(429).json({
      error: {
        message: `بلغت الحد اليومي (${limits.limit} رسالة). ${req.user ? 'يمكنك الترقية للحصول على حدود أعلى.' : 'سجّل الدخول للحصول على حد أعلى.'}`,
        type: 'daily_limit_exceeded',
        code: 'daily_limit',
        limit: limits.limit,
        used: limits.usage.messages,
        reset_at: limits.resetAt,
      },
    });
  }

  const controller = new AbortController();
  let clientClosed = false;
  res.on('close', () => {
    if (!res.writableFinished) {
      clientClosed = true;
      controller.abort();
    }
  });

  if (target.provider === 'photon') {
    const ready = await photon.ensureAvailable();
    if (!ready.ok) {
      const failure = photon.unavailableError();
      res.setHeader('Retry-After', String(failure.retryAfter || 30));
      return openaiError(res, failure.status, failure.message, { code: failure.code, type: 'service_unavailable' });
    }
  }

  const id = `chatcmpl-${uid(12)}`;
  const created = Math.floor(Date.now() / 1000);
  const sendHeaders = {
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
    'X-Cosmos-Model': model,
    'X-RateLimit-Limit': String(limits.limit || 0),
    'X-RateLimit-Remaining': String(limits.remaining === Infinity ? '' : limits.remaining),
  };

  if (stream) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Connection', 'keep-alive');
    for (const [k, v] of Object.entries(sendHeaders)) res.setHeader(k, v);
    res.flushHeaders();
    sseWrite(res, {
      id, object: 'chat.completion.chunk', created, model,
      choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
    });
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': ping\n\n');
    }, 15_000);
    let gotText = false;
    let result = null;
    try {
      result = await runner.streamChat({
        messages,
        model: target.provider === 'photon' ? undefined : config.ai.model,
        mode, system, temperature, maxTokens,
        signal: controller.signal,
        onDelta: (text) => {
          gotText = true;
          sseWrite(res, {
            id, object: 'chat.completion.chunk', created, model,
            choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
          });
        },
      });
      if (!gotText) {
        sseWrite(res, {
          id, object: 'chat.completion.chunk', created, model,
          choices: [{ index: 0, delta: { content: 'لم يصل أي نص من النموذج. حاول مرة أخرى أو غيّر النموذج.' }, finish_reason: null }],
        });
      }
      sseWrite(res, {
        id, object: 'chat.completion.chunk', created, model,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        usage: result.usage || undefined,
        demo: result.demo || undefined,
      });
      sseWrite(res, '[DONE]');
    } catch (err) {
      if (clientClosed || err.name === 'AbortError') {
        // العميل أغلق الاتصال
      } else {
        console.warn('[chat] stream error:', err.code || '', err.internal || err.message, err.upstreamDetail || '');
        sseWrite(res, {
          error: {
            message: err.message || 'تعذّر إكمال الرد.',
            type: err.code || 'upstream_error',
            code: err.code || 'ai_error',
            ...(err.retryAfter ? { retry_after: err.retryAfter } : {}),
          },
        });
        sseWrite(res, '[DONE]');
      }
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
      if (gotText || result) {
        try {
          await store.incrementUsage(req.owner, result?.usage?.prompt_tokens || 0, result?.usage?.completion_tokens || 0);
          await logEvent('chat', {
            model, mode,
            demo: Boolean(result?.demo),
            chars: result?.text?.length || 0,
            userId: req.user?.id || null,
          }, req);
        } catch (e) {
          console.warn('[usage]', e.message);
        }
      }
    }
    return;
  }

  try {
    const result = await runner.completeChat({
      messages,
      model: target.provider === 'photon' ? undefined : config.ai.model,
      mode, system, temperature, maxTokens,
      signal: controller.signal,
    });
    const content = result.text || '';
    await store.incrementUsage(req.owner, result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0);
    await logEvent('chat', { model, mode, demo: Boolean(result.demo), chars: content.length, userId: req.user?.id || null }, req);
    if (result.demo) res.setHeader('X-Cosmos-Demo', '1');
    for (const [k, v] of Object.entries(sendHeaders)) res.setHeader(k, v);
    return res.json({
      id,
      object: 'chat.completion',
      created,
      model,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      demo: result.demo || undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError' || clientClosed) return;
    console.warn('[chat] error:', err.code || '', err.internal || err.message, err.upstreamDetail || '');
    if (err.retryAfter) res.setHeader('Retry-After', String(err.retryAfter));
    const type = err.code === 'quota_exceeded' ? 'rate_limit_exceeded'
      : err.code === 'photon_unavailable' ? 'service_unavailable'
        : 'upstream_error';
    return openaiError(res, err.status || 502, err.message || 'تعذّر توليد الرد.', { code: err.code || 'ai_error', type });
  }
}

router.get('/v1/models', asyncHandler(async (req, res) => {
  await models.primeAvailability();
  res.json({
    object: 'list',
    data: models.list().map((m) => ({ id: m.id, object: 'model', created: 0, owned_by: 'cosmos', ...m })),
  });
}));

router.get('/api/models', asyncHandler(async (req, res) => {
  await models.primeAvailability();
  models.refreshAvailability();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ data: models.list(), demo: gemini.isDemo() });
}));

router.post('/v1/chat/completions', chatLimiter, asyncHandler(handleChat));
router.post('/api/chat', chatLimiter, asyncHandler(handleChat));

router.post('/reset-session', asyncHandler(async (req, res) => {
  res.json({ ok: true, agent: req.query.agent || 'all', stateless: true, note: 'الجلسات عندنا عديمة الحالة على مستوى النموذج؛ سياق المحادثة يُرسل مع كل طلب.' });
}));

module.exports = router;
module.exports.handleChat = handleChat;
