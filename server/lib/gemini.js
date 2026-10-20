'use strict';

const config = require('../config');
const { sleep, truncate } = require('./util');

const ARABIC_ERRORS = {
  400: 'الطلب غير صالح. قد يكون حجم الصورة أو المحتوى أكبر من المسموح.',
  401: 'مفتاح Gemini مرفوض. تحقّق من GEMINI_API_KEY في ملف .env.',
  403: 'الحساب لا يملك صلاحية استخدام هذا النموذج أو انتهت صلاحية المفتاح.',
  404: 'النموذج المطلوب غير متاح لهذا الحساب. جرّب نموذجًا آخر أو راجع GEMINI_MODEL.',
  429: 'تم تجاوز حصة Gemini أو حد الطلبات. انتظر قليلًا ثم أعد المحاولة.',
  500: 'خدمة Gemini تعذّرت مؤقتًا. أعد المحاولة بعد لحظات.',
  503: 'خدمة Gemini مشغولة الآن. أعد المحاولة بعد لحظات.',
};

class AiError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = 'AiError';
    this.status = meta.status || 502;
    this.code = meta.code || 'ai_error';
    this.upstreamStatus = meta.upstreamStatus;
    this.upstreamDetail = meta.upstreamDetail;
    this.retryable = Boolean(meta.retryable);
  }
}

const ALIASES = {
  'cosmos-blazar-3': { target: 'model', label: 'Cosmos Blazar 3' },
  'blazar': { target: 'model', label: 'Cosmos Blazar 3' },
  'cosmos-photon-3': { target: 'fastModel', label: 'Cosmos Photon 3' },
  'photon': { target: 'fastModel', label: 'Cosmos Photon 3' },
  'cosmos-vision': { target: 'visionModel', label: 'Cosmos Vision' },
  'vision': { target: 'visionModel', label: 'Cosmos Vision' },
};

function resolveModel(requested) {
  const name = String(requested || '').trim();
  if (name && ALIASES[name.toLowerCase()]) {
    const alias = ALIASES[name.toLowerCase()];
    return config.ai[alias.target] || config.ai.model;
  }
  if (!name) return config.ai.model;
  const known = [config.ai.model, config.ai.fastModel, config.ai.visionModel, config.ai.imageModel, config.ai.fallbackModel].filter(Boolean);
  if (known.includes(name)) return name;
  if (/^[a-z0-9][a-z0-9._-]{2,80}$/i.test(name) && name.startsWith('gemini-')) return name;
  if (/^[a-z0-9][a-z0-9._-]{2,80}$/i.test(name) && name.startsWith('gemma-')) return name;
  return config.ai.model;
}

function isDemo() {
  return config.ai.provider === 'mock';
}

function listModels() {
  const vision = config.ai.visionModel;
  return [
    {
      id: 'cosmos-blazar-3',
      object: 'model',
      label: 'Cosmos Blazar 3',
      description: 'الأقوى — للمهام الطويلة والفهم العميق والكتابة الاحترافية',
      tag: 'الرائد',
      upstream: config.ai.model,
      capabilities: { vision: Boolean(vision), streaming: true, images: Boolean(config.ai.imageModel) },
    },
    {
      id: 'cosmos-photon-3',
      object: 'model',
      label: 'Cosmos Photon 3',
      description: 'خفيف وسريع جدًا — للمهام اليومية والمحادثات القصيرة',
      tag: 'سريع',
      upstream: config.ai.fastModel,
      capabilities: { vision: Boolean(vision), streaming: true, images: false },
    },
  ];
}

function systemPrompt(mode, extra) {
  const base = config.ai.systemPrompt || [
    'أنت Cosmos، مساعد ذكاء اصطناعي عربي ودود ودقيق.',
    'أجب بلغة المستخدم (العربية افتراضيًا) وبأسلوب واضح ومنظم.',
    'استخدم Markdown عند الحاجة: عناوين قصيرة، قوائم، وجداول عند المناسبة.',
    'في الأسئلة التقنية ضع الكود داخل كتل برمجية مع تحديد اللغة.',
    'لا تختلق معلومات أو مصادر. إن لم تكن متأكدًا قل ذلك واقترح طريقة للتحقق.',
    'كن مختصرًا في الأسئلة البسيطة ومفصّلًا في المهام المعقدة.',
    'راعِ الخصوصية: لا تطلب بيانات شخصية حساسة ولا تخزّنها.',
  ].join('\n');
  const modes = {
    code: '\n\nوضع الكود: ركّز على الحلول القابلة للتشغيل، اشرح الخطوات بإيجاز، اذكر المتطلبات والحواف، وأضف اختبارات قصيرة عندما يكون ذلك مفيدًا.',
    study: '\n\nوضع الدراسة: اشرح تدريجيًا بأمثلة، ولخّص النقاط الأساسية في النهاية.',
    writing: '\n\nوضع الكتابة: حسّن الوضوح والأسلوب، واقترح عنوانًا ونسخة بديلة عند الحاجة.',
  };
  const today = new Date().toISOString().slice(0, 10);
  const extras = ['\n\nالتاريخ الحالي (UTC): ' + today];
  if (extra) extras.push('\n\nتعليمات إضافية من المستخدم:\n' + truncate(extra, 4000));
  return base + (modes[mode] || '') + extras.join('');
}

function contentToParts(content) {
  if (typeof content === 'string') return [{ text: content }];
  if (!Array.isArray(content)) return [];
  const parts = [];
  for (const item of content) {
    if (!item) continue;
    if (item.type === 'text' && typeof item.text === 'string') {
      parts.push({ text: item.text });
    } else if (item.type === 'image_url') {
      const url = typeof item.image_url === 'string' ? item.image_url : item.image_url?.url;
      if (typeof url === 'string' && url.startsWith('data:')) {
        const m = url.match(/^data:([a-zA-Z0-9.+/-]+);base64,(.+)$/s);
        if (!m) continue;
        const mime = m[1].toLowerCase();
        if (!/^image\/(png|jpeg|jpg|webp|gif|heic|heif)$/.test(mime)) continue;
        const data = m[2].replace(/\s+/g, '');
        if (data.length > 11 * 1024 * 1024) continue;
        parts.push({ inlineData: { mimeType: mime === 'image/jpg' ? 'image/jpeg' : mime, data } });
      } else if (typeof url === 'string' && /^https:\/\//i.test(url)) {
        parts.push({ _remoteImage: url });
      }
    } else if (item.type === 'input_image' && typeof item.image_url === 'string') {
      parts.push({ _remoteImage: item.image_url });
    } else if (item.type === 'file' && item.file) {
      const file = item.file;
      if (file.file_data && file.filename) {
        const mime = file.mime_type || 'application/octet-stream';
        if (mime.startsWith('image/') || mime === 'application/pdf') {
          parts.push({ inlineData: { mimeType: mime === 'image/jpg' ? 'image/jpeg' : mime, data: String(file.file_data).replace(/\s+/g, '') } });
        } else if (mime.startsWith('text/') || /json|javascript|xml|yaml|csv|markdown/i.test(mime)) {
          try {
            const text = Buffer.from(file.file_data, 'base64').toString('utf8');
            parts.push({ text: `\n\n--- ملف: ${file.filename} ---\n${truncate(text, 30000)}\n--- نهاية الملف ---\n` });
          } catch { /* ignore */ }
        }
      }
    }
  }
  return parts;
}

async function inlineRemoteImages(parts) {
  const out = [];
  for (const part of parts) {
    if (!part._remoteImage) { out.push(part); continue; }
    try {
      const url = new URL(part._remoteImage);
      const host = url.hostname.toLowerCase();
      if (!/^https:$/.test(url.protocol)) continue;
      if (host === 'localhost' || host.endsWith('.local') || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === '::1' || host === '0.0.0.0') continue;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
      clearTimeout(timer);
      if (!res.ok) continue;
      const type = (res.headers.get('content-type') || '').split(';')[0].toLowerCase();
      if (!/^image\//.test(type)) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 8 * 1024 * 1024) continue;
      out.push({ inlineData: { mimeType: type === 'image/jpg' ? 'image/jpeg' : type, data: buf.toString('base64') } });
    } catch {
      /* تجاهل الصور البعيدة غير القابلة للجلب */
    }
  }
  return out;
}

async function buildPayload({ messages, mode, system, temperature, maxTokens }) {
  const systemText = systemPrompt(mode, system);
  const turns = [];
  for (const msg of messages || []) {
    if (!msg || msg.role === 'system') continue;
    const role = msg.role === 'assistant' ? 'model' : 'user';
    let parts = contentToParts(msg.content);
    if (!parts.length) continue;
    if (parts.some((p) => p._remoteImage)) parts = await inlineRemoteImages(parts);
    if (!parts.length) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.parts.push(...parts);
    else turns.push({ role, parts });
  }
  while (turns.length && turns[0].role === 'model') turns.shift();
  if (!turns.length) turns.push({ role: 'user', parts: [{ text: 'مرحبًا' }] });
  const usesGemma = /gemma/i.test(config.ai.model);
  let systemInstruction;
  if (usesGemma) {
    const first = turns[0];
    first.parts = [{ text: systemText + '\n\n---\n\n' }, ...first.parts];
  } else {
    systemInstruction = { parts: [{ text: systemText }] };
  }
  const payload = {
    contents: turns,
    generationConfig: {
      temperature: Number.isFinite(Number(temperature)) ? Math.min(2, Math.max(0, Number(temperature))) : 0.7,
      topP: 0.95,
      maxOutputTokens: Math.min(16384, Math.max(256, Number(maxTokens) || 4096)),
    },
  };
  if (systemInstruction) payload.systemInstruction = systemInstruction;
  if (!usesGemma) {
    payload.safetySettings = [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ];
  }
  return payload;
}

function upstreamMessage(status, detail) {
  const first = String(detail || '').match(/message"?\s*:\s*"([^"]+)"/);
  const base = ARABIC_ERRORS[status] || 'تعذّر الاتصال بنموذج Gemini.';
  return first ? `${base}` : base;
}

function extractText(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  const parts = data.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.filter((p) => p && !p.thought).map((p) => p.text || '').join('');
  }
  if (data.choices?.[0]?.delta?.content) return data.choices[0].delta.content;
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
  return '';
}

function extractUsage(data) {
  const u = data?.usageMetadata || data?.usage;
  if (!u) return null;
  return {
    prompt_tokens: u.promptTokenCount ?? u.prompt_tokens ?? 0,
    completion_tokens: u.candidatesTokenCount ?? u.completion_tokens ?? 0,
    total_tokens: u.totalTokenCount ?? u.total_tokens ?? 0,
  };
}

function errorFromResponse(status, bodyText) {
  let detail = bodyText;
  try {
    const parsed = JSON.parse(bodyText);
    detail = parsed.error?.message || parsed.message || bodyText;
  } catch { /* raw */ }
  return new AiError(upstreamMessage(status, detail), {
    status: status === 429 ? 429 : 502,
    upstreamStatus: status,
    upstreamDetail: truncate(detail, 800),
    code: status === 429 ? 'quota_exceeded' : status === 401 || status === 403 ? 'auth_failed' : 'upstream_error',
    retryable: status === 429 || status >= 500,
  });
}

function makeTimeoutSignal(signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), config.ai.timeoutMs);
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

async function callUpstream(model, payload, { stream, signal }) {
  const action = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  const url = `${config.ai.baseUrl}/v1beta/models/${encodeURIComponent(model)}:${action}`;
  const { signal: timeoutSignal, cleanup } = makeTimeoutSignal(signal);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.ai.apiKey,
        Accept: stream ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify(payload),
      signal: timeoutSignal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      cleanup();
      throw errorFromResponse(res.status, text);
    }
    return { res, cleanup };
  } catch (err) {
    cleanup();
    throw err;
  }
}

async function streamUpstream({ model, payload, signal, onDelta }) {
  const candidates = [model];
  if (config.ai.fallbackModel && config.ai.fallbackModel !== model) candidates.push(config.ai.fallbackModel);
  let lastError;
  for (const candidate of candidates) {
    try {
      const { res, cleanup } = await callUpstream(candidate, payload, { stream: true, signal });
      const ctype = res.headers.get('content-type') || '';
      let full = '';
      let usage = null;
      if (!ctype.includes('text/event-stream')) {
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = null; }
        if (Array.isArray(data)) {
          for (const chunk of data) {
            const t = extractText(chunk);
            if (t) { full += t; onDelta(t); }
            usage = extractUsage(chunk) || usage;
          }
        } else if (data) {
          const t = extractText(data);
          if (t) { full += t; onDelta(t); }
          usage = extractUsage(data) || usage;
        }
        cleanup();
        return { text: full, usage, model: candidate };
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
        for (const evt of events) {
          const lines = evt.split(/\r?\n/);
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (!raw || raw === '[DONE]') continue;
            let data;
            try { data = JSON.parse(raw); } catch { continue; }
            if (data.error) {
              throw new AiError(upstreamMessage(data.error.code || 500, data.error.message), {
                upstreamStatus: data.error.code,
                upstreamDetail: truncate(data.error.message, 800),
                code: 'upstream_error',
              });
            }
            const t = extractText(data);
            if (t) { full += t; onDelta(t); }
            usage = extractUsage(data) || usage;
          }
        }
      }
      if (buffer.trim().startsWith('data:')) {
        try {
          const data = JSON.parse(buffer.trim().slice(5).trim());
          const t = extractText(data);
          if (t) { full += t; onDelta(t); }
          usage = extractUsage(data) || usage;
        } catch { /* ignore */ }
      }
      cleanup();
      return { text: full, usage, model: candidate };
    } catch (err) {
      lastError = err;
      if (signal?.aborted) throw err;
      const status = err.upstreamStatus;
      if (!(status === 404 || (status === 400 && /model|not found|unsupported/i.test(err.upstreamDetail || '')))) break;
    }
  }
  throw lastError || new AiError('فشل الاتصال بالنموذج', { code: 'upstream_error' });
}

async function generateUpstream({ model, payload, signal }) {
  const { res, cleanup } = await callUpstream(model, payload, { stream: false, signal });
  try {
    const data = await res.json();
    return { text: extractText(data), usage: extractUsage(data), model, data };
  } finally {
    cleanup();
  }
}

/* ---------------------------------- Mock ---------------------------------- */
function mockAnswer(messages, mode) {
  const last = [...(messages || [])].reverse().find((m) => m.role === 'user');
  const text = typeof last?.content === 'string'
    ? last.content
    : Array.isArray(last?.content)
      ? last.content.filter((p) => p.type === 'text').map((p) => p.text).join(' ')
      : '';
  const hasImage = Array.isArray(last?.content) && last.content.some((p) => p.type === 'image_url');
  const wantsCode = /كود|code|برمجة|javascript|python|react|sql|دالة|function/i.test(text);
  const clean = truncate(text.trim().replace(/\s+/g, ' '), 180);
  const intro = '### وضع العرض التجريبي\n\nلا يوجد اتصال بنموذج **Gemini** في هذه البيئة، لذلك هذا رد محلي تجريبي وليس ردًا من الذكاء الاصطناعي. الواجهة وكل ميزات التطبيق تعمل، وبمجرد وضع مفتاح `GEMINI_API_KEY` صحيح في `.env` ستتحول الردود إلى النموذج الحقيقي تلقائيًا.\n\n';
  const echo = clean ? `**ما وصلني منك:**\n> ${clean}${text.length > 180 ? '…' : ''}\n\n` : '';
  const imageNote = hasImage ? 'وصلت الصورة المرفقة بنجاح، وسيتم تحليلها بصريًا عند تفعيل نموذج يدعم الرؤية.\n\n' : '';
  let body;
  if (wantsCode) {
    body = 'إليك نموذجًا مصغرًا يوضح شكل الرد البرمجي (وضع الكود):\n\n```js\n// دالة تقطع نصًا طويلًا إلى أسطر قصيرة\nexport function wrap(text, width = 60) {\n  const words = String(text).split(/\\s+/);\n  const lines = [];\n  let line = "";\n  for (const word of words) {\n    if ((line + " " + word).trim().length > width) {\n      lines.push(line.trim());\n      line = word;\n    } else {\n      line += " " + word;\n    }\n  }\n  if (line.trim()) lines.push(line.trim());\n  return lines.join("\\n");\n}\n```\n\nثم جرّب:\n\n```js\nconsole.log(wrap("مرحبًا بك في Cosmos، مساحة واحدة لكل أفكارك", 24));\n```\n\n';
  } else if (mode === 'writing') {
    body = '**مسودة مقترحة:**\n\nنكتب اليوم خطوةً جديدة نحو مساحة عمل أهدأ: أدواتٌ تفهم لغتك، وتحترم وقتك، وتبقى بين يديك. في Cosmos نؤمن أن التقنية الجيدة لا ترفع صوتها؛ إنها فقط تجعل الأمور تسير.\n\n**بديل أقصر:**\n\nمساحة واحدة لأفكارك: اكتب، اسأل، وأنجز — بلغتك.\n\n';
  } else {
    body = '**ماذا يعمل الآن في هذه النسخة؟**\n\n- واجهة الدردشة كاملة: بث الردود، إيقاف التوليد، إعادة التوليد، نسخ الرد، وتصدير المحادثة.\n- إرفاق الصور والملفات النصية، وتحليلها بصريًا عند تفعيل نموذج الرؤية.\n- البحث في المحادثات، الملاحظات، المهام، المكتبة، الوضعين الفاتح والداكن، ودعم الجوال.\n- حسابات Google، ورمز دخول بالبريد، وخطط الاشتراك عبر Stripe، ولوحة إدارة محمية.\n- حدود استخدام وحماية من الطلبات الآلية، مع سجلات أمنية.\n\n**الخطوة التالية:** ضع مفتاح Gemini صالحًا في `.env` ثم أعد تشغيل الخادم، وستصبح الردود حقيقية دون أي تغيير في الواجهة.\n\n';
  }
  return intro + echo + imageNote + body + '_هذا الرد من مزوّد العرض المحلي (mock) وليس من Gemini._';
}

async function mockStream({ messages, mode, signal, onDelta }) {
  const answer = mockAnswer(messages, mode);
  let text = '';
  const chunks = answer.match(/[\s\S]{1,7}/g) || [];
  for (const chunk of chunks) {
    if (signal?.aborted) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }
    text += chunk;
    onDelta(chunk);
    await sleep(10);
  }
  return { text, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, model: 'cosmos-demo', demo: true };
}

/* -------------------------------- Public API ------------------------------- */
async function streamChat({ messages, model, mode, system, temperature, maxTokens, signal, onDelta }) {
  if (isDemo()) return mockStream({ messages, mode, signal, onDelta });
  const chosen = resolveModel(model);
  const payload = await buildPayload({ messages, mode, system, temperature, maxTokens });
  try {
    const result = await streamUpstream({ model: chosen, payload, signal, onDelta });
    return { ...result, demo: false };
  } catch (err) {
    if (signal?.aborted || err.name === 'AbortError') throw err;
    if (config.ai.demoFallback) {
      const notice = `> **تعذّر الوصول إلى Gemini من شبكة الخادم.**\n>\n> ${err.message}\n>\n> تحقّق من اتصال الخادم بالإنترنت، ومن صحة المفتاح والنموذج في \`.env\`، ثم أعد المحاولة. يمكنك متابعة تجربة الواجهة أدناه.\n\n`;
      const fallback = '\n\n' + mockAnswer(messages, mode);
      let text = '';
      for (const chunk of (notice + fallback).match(/[\s\S]{1,8}/g) || []) {
        if (signal?.aborted) break;
        text += chunk;
        onDelta(chunk);
        await sleep(8);
      }
      return {
        text,
        usage: null,
        model: 'cosmos-demo',
        demo: true,
        upstreamError: { message: err.message, status: err.upstreamStatus, detail: err.upstreamDetail },
      };
    }
    throw err;
  }
}

async function completeChat({ messages, model, mode, system, temperature, maxTokens, signal }) {
  if (isDemo()) {
    let text = '';
    const result = await mockStream({ messages, mode, signal, onDelta: (t) => { text += t; } });
    return { ...result, text };
  }
  const chosen = resolveModel(model);
  const payload = await buildPayload({ messages, mode, system, temperature, maxTokens });
  try {
    return { ...(await generateUpstream({ model: chosen, payload, signal })), demo: false };
  } catch (err) {
    if (config.ai.demoFallback) {
      const text = mockAnswer(messages, mode);
      return { text, usage: null, model: 'cosmos-demo', demo: true, upstreamError: { message: err.message } };
    }
    throw err;
  }
}

async function generateImage({ prompt, signal }) {
  const imageModel = config.ai.imageModel;
  if (isDemo()) {
    const svg = demoImageSvg(prompt);
    return { dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, model: 'cosmos-demo', demo: true, mimeType: 'image/svg+xml' };
  }
  if (!imageModel) {
    const err = new AiError('توليد الصور غير مهيأ. أضف GEMINI_IMAGE_MODEL إلى .env (مثال: gemini-2.5-flash-image-preview).', { status: 503, code: 'image_not_configured' });
    throw err;
  }
  const payload = {
    contents: [{ role: 'user', parts: [{ text: `أنشئ صورة: ${prompt}` }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  };
  try {
    const { res, cleanup } = await callUpstream(imageModel, payload, { stream: false, signal });
    let data;
    try { data = await res.json(); } finally { cleanup(); }
    const parts = data.candidates?.[0]?.content?.parts || [];
    const image = parts.find((p) => p.inlineData);
    if (!image) {
      throw new AiError('لم يُرجع النموذج صورة. جرّب وصفًا أوضح أو نموذج صور آخر.', { status: 502, code: 'no_image' });
    }
    return {
      dataUrl: `data:${image.inlineData.mimeType};base64,${image.inlineData.data}`,
      model: imageModel,
      mimeType: image.inlineData.mimeType,
      text: parts.filter((p) => p.text).map((p) => p.text).join(' '),
    };
  } catch (err) {
    if (signal?.aborted || err.name === 'AbortError') throw err;
    if (!config.ai.demoFallback) throw err;
    const svg = demoImageSvg(prompt);
    return {
      dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      model: 'cosmos-demo',
      demo: true,
      mimeType: 'image/svg+xml',
      text: 'تعذّر الوصول إلى نموذج الصور، لذا عُرضت صورة توضيحية محلية.',
      upstreamError: { message: err.message, status: err.status },
    };
  }
}

function demoImageSvg(prompt) {
  const safe = String(prompt || 'Cosmos').replace(/[<>&"']/g, '').slice(0, 80);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d5efc"/><stop offset=".5" stop-color="#22d3ee"/><stop offset="1" stop-color="#a855f7"/></linearGradient>
  <radialGradient id="r" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#000000" stop-opacity=".25"/></radialGradient></defs>
  <rect width="1024" height="1024" fill="url(#g)"/><rect width="1024" height="1024" fill="url(#r)"/>
  <circle cx="780" cy="240" r="140" fill="#fff" opacity=".16"/><circle cx="230" cy="760" r="200" fill="#000" opacity=".12"/>
  <text x="512" y="470" text-anchor="middle" font-family="system-ui,Segoe UI" font-size="34" fill="#ffffffcc">Cosmos · Demo Image</text>
  <text x="512" y="540" text-anchor="middle" font-family="system-ui,Segoe UI" font-size="48" font-weight="700" fill="#fff">${safe}</text>
  <text x="512" y="610" text-anchor="middle" font-family="system-ui,Segoe UI" font-size="24" fill="#ffffffb0">صورة توضيحية محلية — فعّل GEMINI_IMAGE_MODEL لتوليد صور حقيقية</text>
  </svg>`;
}

async function probe({ model, timeoutMs = 20000 } = {}) {
  if (isDemo()) {
    return { ok: true, demo: true, ms: 0, text: 'وضع العرض المحلي (mock) مفعّل — لا يوجد اتصال Gemini.', model: 'cosmos-demo' };
  }
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const payload = await buildPayload({
      messages: [{ role: 'user', content: 'قل كلمة واحدة فقط: متصل' }],
      mode: 'chat',
      maxTokens: 32,
    });
    const chosen = resolveModel(model || config.ai.model);
    const result = await generateUpstream({ model: chosen, payload, signal: controller.signal });
    return { ok: true, demo: false, ms: Date.now() - started, text: truncate(result.text, 120), model: result.model, usage: result.usage };
  } catch (err) {
    return {
      ok: false,
      demo: false,
      ms: Date.now() - started,
      model: resolveModel(model || config.ai.model),
      error: err.message,
      upstreamStatus: err.upstreamStatus || null,
      detail: err.upstreamDetail || null,
      code: err.code || null,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  AiError, streamChat, completeChat, generateImage, listModels, resolveModel,
  systemPrompt, isDemo, mockAnswer, probe, config,
};
