'use strict';

/**
 * عميل "Cosmos Photon 3".
 * يتصل بخدمة دردشة محلية متوافقة مع OpenAI (DeepSeek Chat) على العنوان
 * المهيأ في DEEPSEEK_BASE_URL — ولا يكشف هذا العنوان أو أي مفتاح للمتصفح.
 */

const { spawn } = require('node:child_process');
const config = require('../config');
const { truncate } = require('./util');

const HEALTH_TTL_MS = 15_000;

class PhotonError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = 'PhotonError';
    this.status = meta.status || 503;
    this.code = meta.code || 'photon_unavailable';
    this.retryAfter = meta.retryAfter || null;
    this.internal = meta.internal || null;
  }
}

const state = {
  health: null,
  checkedAt: 0,
  inflight: null,
  lastError: null,
  lastLatencyMs: null,
  startAttemptAt: 0,
  startInflight: null,
  startedByUs: false,
};

function configured() {
  return Boolean(config.photon.baseUrl);
}

function baseUrl() {
  return config.photon.baseUrl;
}

function authHeaders() {
  return config.photon.apiKey ? { Authorization: `Bearer ${config.photon.apiKey}` } : {};
}

/** بصمة غير حساسة للعنوان: تُستخدم في التشخيص الإداري فقط. */
function endpointFingerprint() {
  try {
    const url = new URL(baseUrl());
    const loopback = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname);
    return { scope: loopback ? 'local' : 'remote', secure: url.protocol === 'https:' };
  } catch {
    return { scope: 'invalid', secure: false };
  }
}

function combineSignals(signal, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  const onAbort = () => controller.abort(new Error('aborted'));
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    },
  };
}

async function probeOnce() {
  const started = Date.now();
  const { signal, cleanup } = combineSignals(null, config.photon.healthTimeoutMs);
  try {
    const res = await fetch(baseUrl() + config.photon.healthPath, {
      method: 'GET',
      headers: { Accept: 'application/json', ...authHeaders() },
      signal,
    });
    if (res.ok) {
      await res.text().catch(() => '');
      return { ok: true, latencyMs: Date.now() - started };
    }
    /* بعض الخدمات لا توفّر /v1/models لكنها تستجيب لمسار تصفير الجلسة */
    const reset = await fetch(`${baseUrl()}/reset-session?agent=all`, {
      method: 'POST',
      headers: { Accept: 'application/json', ...authHeaders() },
      signal,
    });
    await reset.text().catch(() => '');
    return { ok: reset.ok || reset.status < 500, latencyMs: Date.now() - started, status: reset.status };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - started, error: err.name === 'AbortError' ? 'timeout' : 'unreachable' };
  } finally {
    cleanup();
  }
}

/**
 * فحص صحة مع تخزين مؤقت. لا يرمي استثناء أبدًا.
 * @param {{force?: boolean}} options
 */
async function health(options = {}) {
  const fresh = Date.now() - state.checkedAt < HEALTH_TTL_MS;
  if (!options.force && fresh && state.health) return state.health;
  if (state.inflight) return state.inflight;
  state.inflight = (async () => {
    const result = await probeOnce();
    state.health = { ...result, checkedAt: new Date().toISOString() };
    state.checkedAt = Date.now();
    state.lastLatencyMs = result.latencyMs;
    state.lastError = result.ok ? null : (result.error || `status ${result.status}`);
    if (!result.ok) console.warn('[photon] فشل فحص التوفر:', state.lastError);
    state.inflight = null;
    return state.health;
  })();
  return state.inflight;
}

/** حالة مخزّنة سريعة للاستخدام المتزامن في قوائم النماذج. */
function isAvailableCached() {
  return Boolean(state.health && state.health.ok && Date.now() - state.checkedAt < HEALTH_TTL_MS);
}

function cachedHealth() {
  return state.health;
}

async function resetSession(signal) {
  const { signal: timed, cleanup } = combineSignals(signal, Math.min(8000, config.photon.timeoutMs));
  try {
    await fetch(`${baseUrl()}/reset-session?agent=all`, {
      method: 'POST',
      headers: { Accept: 'application/json', ...authHeaders() },
      signal: timed,
    }).then((r) => r.text()).catch(() => '');
  } finally {
    cleanup();
  }
}

async function startService() {
  if (!config.photon.autostart || !config.photon.startCommand) return { ok: false, reason: 'autostart_disabled' };
  if (state.startInflight) return state.startInflight;
  if (Date.now() - state.startAttemptAt < 30_000) return { ok: false, reason: 'throttled' };
  state.startAttemptAt = Date.now();
  state.startInflight = (async () => {
    try {
      const child = spawn(config.photon.startCommand, {
        shell: true,
        detached: true,
        stdio: 'ignore',
        cwd: config.root,
        env: process.env,
      });
      child.unref();
      state.startedByUs = true;
      console.log('[photon] بدء تشغيل خدمة Cosmos Photon 3 المحلية');
      const deadline = Date.now() + config.photon.startWaitMs;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 700));
        const result = await health({ force: true });
        if (result.ok) return { ok: true, latencyMs: result.latencyMs };
      }
      state.lastError = 'start_timeout';
      return { ok: false, reason: 'start_timeout' };
    } catch (err) {
      state.lastError = err.message;
      return { ok: false, reason: 'spawn_failed' };
    } finally {
      state.startInflight = null;
    }
  })();
  return state.startInflight;
}

/** يضمن أن الخدمة متاحة، ويحاول تشغيلها إن كان ذلك مسموحًا ومهيأً. */
async function ensureAvailable() {
  if (!configured()) return { ok: false, reason: 'not_configured' };
  let result = await health();
  if (result.ok) return result;
  if (config.photon.autostart && config.photon.startCommand) {
    const started = await startService();
    if (started.ok) return health({ force: true });
  }
  return result;
}

function unavailableError() {
  return new PhotonError('Cosmos Photon 3 غير متاح مؤقتًا. لم نتمكن من الوصول إلى خدمة النموذج. حاول بعد قليل أو اختر Cosmos Blazar 3.', {
    status: 503,
    code: 'photon_unavailable',
    retryAfter: 30,
    internal: state.lastError,
  });
}

function mapHttpError(status, detail) {
  const text = truncate(String(detail || ''), 500);
  if (status === 401 || status === 403) {
    return new PhotonError('تعذّر التحقق من خدمة Cosmos Photon 3. راجع إعدادات الخادم.', {
      status: 503, code: 'photon_auth', internal: `HTTP ${status}: ${text}`,
    });
  }
  if (status === 404) {
    return new PhotonError('نموذج Cosmos Photon 3 غير متاح على الخدمة الحالية. راجع إعدادات الخادم.', {
      status: 503, code: 'photon_model_missing', internal: `HTTP 404: ${text}`,
    });
  }
  if (status === 429) {
    return new PhotonError('خدمة Cosmos Photon 3 مشغولة الآن. أعد المحاولة بعد قليل.', {
      status: 429, code: 'photon_busy', retryAfter: 20, internal: text,
    });
  }
  return new PhotonError('تعذّر إكمال الرد من Cosmos Photon 3. أعد المحاولة.', {
    status: 502, code: 'photon_error', internal: `HTTP ${status}: ${text}`,
  });
}

function systemMessage(system) {
  return system ? [{ role: 'system', content: String(system) }] : [];
}

/** يحوّل أجزاء الملفات غير المدعومة إلى نص وصفي حتى لا ترفضها الخدمة. */
function normalizeContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    if (part.type === 'text' && part.text) parts.push({ type: 'text', text: String(part.text) });
    else if (part.type === 'image_url' && part.image_url?.url) parts.push({ type: 'image_url', image_url: { url: part.image_url.url } });
    else if (part.type === 'file') parts.push({ type: 'text', text: `[ملف مرفق: ${part.file?.filename || 'ملف'}]` });
  }
  return parts.length ? parts : '';
}

function buildMessages(messages, system) {
  const out = systemMessage(system);
  for (const message of messages || []) {
    if (!message) continue;
    const content = normalizeContent(message.content);
    if (!content) continue;
    out.push({ role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user', content });
  }
  return out;
}

function pickModel(messages) {
  const hasImage = (messages || []).some((m) => Array.isArray(m.content) && m.content.some((p) => p && p.type === 'image_url'));
  return hasImage ? config.photon.visionModel : config.photon.model;
}

async function request({ messages, system, model, stream, signal }) {
  const ready = await ensureAvailable();
  if (!ready.ok) throw unavailableError();
  if (config.photon.resetSession) await resetSession(signal);

  const chosen = model || pickModel(messages);
  const { signal: timed, cleanup } = combineSignals(signal, config.photon.timeoutMs);
  let res;
  try {
    res = await fetch(`${baseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: stream ? 'text/event-stream' : 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({
        model: chosen,
        messages: buildMessages(messages, system),
        stream: Boolean(stream),
      }),
      signal: timed,
    });
  } catch (err) {
    cleanup();
    if (err.name === 'AbortError') throw err;
    state.lastError = 'unreachable';
    console.warn('[photon] تعذّر الوصول إلى خدمة Cosmos Photon 3:', err.message);
    state.checkedAt = 0;
    throw unavailableError();
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    cleanup();
    const mapped = mapHttpError(res.status, detail);
    state.lastError = mapped.internal;
    throw mapped;
  }
  return { res, cleanup, model: chosen };
}

async function streamChat({ messages, system, model, signal, onDelta }) {
  const { res, cleanup, model: chosen } = await request({ messages, system, model, stream: true, signal });
  const ctype = res.headers.get('content-type') || '';
  let text = '';
  let usage = null;
  try {
    if (!ctype.includes('text/event-stream')) {
      const raw = await res.text();
      let data = null;
      try { data = JSON.parse(raw); } catch { data = null; }
      const content = data?.choices?.[0]?.message?.content || '';
      if (content) { text = content; onDelta(content); }
      usage = data?.usage || null;
      return { text, usage, model: chosen, provider: 'photon' };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done = false;
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';
      for (const event of events) {
        for (const line of event.split(/\r?\n/)) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') { done = true; break; }
          let data;
          try { data = JSON.parse(payload); } catch { continue; }
          if (data.error) {
            throw mapHttpError(Number(data.error.code) || 502, data.error.message || '');
          }
          const delta = data.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) { text += delta; onDelta(delta); }
          const whole = data.choices?.[0]?.message?.content;
          if (typeof whole === 'string' && whole && !text) { text = whole; onDelta(whole); }
          if (data.usage) usage = data.usage;
        }
        if (done) break;
      }
    }
    const tail = buffer.trim();
    if (!done && tail.startsWith('data:')) {
      const payload = tail.slice(5).trim();
      if (payload && payload !== '[DONE]') {
        try {
          const data = JSON.parse(payload);
          const delta = data.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) { text += delta; onDelta(delta); }
        } catch { /* ignore */ }
      }
    }
    return { text, usage, model: chosen, provider: 'photon' };
  } finally {
    cleanup();
  }
}

async function completeChat({ messages, system, model, signal }) {
  const { res, cleanup, model: chosen } = await request({ messages, system, model, stream: false, signal });
  try {
    const raw = await res.text();
    let data = null;
    try { data = JSON.parse(raw); } catch { data = null; }
    if (!data) throw new PhotonError('رد غير صالح من خدمة Cosmos Photon 3.', { status: 502, code: 'photon_bad_response', internal: raw.slice(0, 300) });
    const content = data.choices?.[0]?.message?.content
      ?? (Array.isArray(data.choices?.[0]?.message?.content) ? data.choices[0].message.content.map((p) => p.text || '').join('') : '')
      ?? '';
    return { text: content, usage: data.usage || null, model: chosen, provider: 'photon' };
  } finally {
    cleanup();
  }
}

function publicError(value) {
  if (!value) return null;
  const text = String(value);
  if (text === 'unreachable' || text === 'timeout' || text === 'start_timeout' || text === 'spawn_failed') return text;
  if (/HTTP 40[13]/.test(text)) return 'auth';
  if (/HTTP 404/.test(text)) return 'model_missing';
  if (/HTTP 429/.test(text)) return 'busy';
  if (/^HTTP/.test(text)) return 'upstream_error';
  return 'service_error';
}

function diagnostics() {
  return {
    configured: configured(),
    endpoint: endpointFingerprint(),
    available: Boolean(state.health?.ok),
    latencyMs: state.lastLatencyMs,
    checkedAt: state.health?.checkedAt || null,
    modelConfigured: Boolean(config.photon.model),
    visionConfigured: Boolean(config.photon.visionModel),
    resetSession: config.photon.resetSession,
    autostart: Boolean(config.photon.autostart && config.photon.startCommand),
    startedByUs: state.startedByUs,
    lastError: publicError(state.lastError),
  };
}

module.exports = {
  PhotonError, configured, health, isAvailableCached, cachedHealth,
  ensureAvailable, startService, resetSession, unavailableError,
  streamChat, completeChat, diagnostics, endpointFingerprint,
};
