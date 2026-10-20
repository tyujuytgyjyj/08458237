'use strict';

const express = require('express');
const store = require('../lib/store');
const { asyncHandler, apiError } = require('../lib/http');
const { iso, truncate } = require('../lib/util');
const { checkUsage, dailyLimitFor, nextReset } = require('../lib/usage');

const router = express.Router();
const MAX_MESSAGES = 250;
const MAX_CHAT_BYTES = 350_000;
const ID_RE = /^[A-Za-z0-9_-]{4,64}$/;

function cleanAttachment(file, budget) {
  if (typeof file === 'string') return { n: truncate(file, 80) };
  if (!file || typeof file !== 'object') return null;
  const out = { n: truncate(file.n || file.name || 'ملف', 80) };
  if (typeof file.th === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(file.th) && file.th.length <= budget) {
    out.th = file.th;
  }
  if (file.kind) out.kind = truncate(file.kind, 20);
  return out;
}

function sanitizeChat(body, owner) {
  if (!body || typeof body !== 'object') return null;
  const rawMsgs = Array.isArray(body.msgs) ? body.msgs : Array.isArray(body.messages) ? body.messages : null;
  if (!rawMsgs) return null;
  if (rawMsgs.length > MAX_MESSAGES) {
    throw Object.assign(new Error(`المحادثة تحتوي أكثر من ${MAX_MESSAGES} رسالة`), { status: 413, expose: true });
  }
  let attachmentBudget = 120_000;
  const msgs = [];
  for (const raw of rawMsgs) {
    if (!raw || typeof raw !== 'object') continue;
    const role = raw.r === 'u' ? 'u' : raw.r === 'a' ? 'a' : raw.r === 'user' ? 'u' : raw.r === 'assistant' ? 'a' : 'u';
    const item = { r: role, c: truncate(typeof raw.c === 'string' ? raw.c : '', 120_000) };
    if (Array.isArray(raw.f) && raw.f.length) {
      const files = raw.f.slice(0, 5).map((f) => cleanAttachment(f, attachmentBudget)).filter(Boolean);
      for (const f of files) if (f.th) attachmentBudget -= f.th.length;
      if (files.length) item.f = files;
    }
    if (raw.err) item.err = 1;
    if (Number.isFinite(Number(raw.ms))) item.ms = Math.max(0, Math.min(600_000, Number(raw.ms)));
    if (raw.mdl) item.mdl = truncate(String(raw.mdl), 80);
    msgs.push(item);
  }
  const title = truncate(String(body.title || 'محادثة بدون عنوان').trim() || 'محادثة بدون عنوان', 120);
  const chat = {
    id: null,
    owner,
    ownerUserId: owner.startsWith('u:') ? owner.slice(2) : null,
    title,
    msgs,
    model: truncate(String(body.model || ''), 80),
    updatedAt: iso(),
    createdAt: iso(),
  };
  if (Buffer.byteLength(JSON.stringify(chat)) > MAX_CHAT_BYTES) {
    throw Object.assign(new Error('المحادثة أكبر من الحد المسموح للحفظ على الخادم'), { status: 413, code: 'chat_too_large', expose: true });
  }
  return chat;
}

function summary(chat) {
  const last = [...(chat.msgs || [])].reverse().find((m) => m.c);
  return {
    id: chat.id,
    title: chat.title,
    updatedAt: chat.updatedAt,
    createdAt: chat.createdAt,
    msgCount: (chat.msgs || []).length,
    preview: truncate(last?.c || '', 140),
  };
}

router.get('/api/chats', asyncHandler(async (req, res) => {
  const chats = await store.find('chats', { owner: req.owner }, { limit: 200 });
  res.json({ chats: chats.map(summary) });
}));

router.get('/api/chats/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!ID_RE.test(id)) return apiError(res, 400, 'معرّف محادثة غير صالح');
  const chat = await store.get('chats', id);
  if (!chat || chat.owner !== req.owner) return apiError(res, 404, 'المحادثة غير موجودة');
  res.json({ chat });
}));

router.put('/api/chats/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!ID_RE.test(id)) return apiError(res, 400, 'معرّف محادثة غير صالح');
  let payload;
  try {
    payload = sanitizeChat(req.body, req.owner);
  } catch (err) {
    return apiError(res, err.status || 400, err.message, { code: err.code });
  }
  if (!payload) return apiError(res, 400, 'بيانات المحادثة غير صالحة');
  const existing = await store.get('chats', id);
  if (existing && existing.owner !== req.owner) return apiError(res, 403, 'لا تملك هذه المحادثة');
  const chat = {
    ...payload,
    id,
    createdAt: existing?.createdAt || iso(),
    updatedAt: iso(),
  };
  await store.set('chats', id, chat);
  res.json({ ok: true, chat: summary(chat) });
}));

router.patch('/api/chats/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!ID_RE.test(id)) return apiError(res, 400, 'معرّف محادثة غير صالح');
  const existing = await store.get('chats', id);
  if (!existing || existing.owner !== req.owner) return apiError(res, 404, 'المحادثة غير موجودة');
  const title = truncate(String(req.body?.title || '').trim(), 120);
  if (!title) return apiError(res, 400, 'العنوان مطلوب');
  const chat = { ...existing, title, updatedAt: iso() };
  await store.set('chats', id, chat);
  res.json({ ok: true, chat: summary(chat) });
}));

router.delete('/api/chats/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!ID_RE.test(id)) return apiError(res, 400, 'معرّف محادثة غير صالح');
  const existing = await store.get('chats', id);
  if (existing && existing.owner !== req.owner) return apiError(res, 403, 'لا تملك هذه المحادثة');
  await store.delete('chats', id);
  res.json({ ok: true });
}));

router.delete('/api/chats', asyncHandler(async (req, res) => {
  if (req.query.confirm !== '1') return apiError(res, 400, 'أرسل confirm=1 للتأكيد');
  const chats = await store.find('chats', { owner: req.owner }, { limit: 1000 });
  for (const chat of chats) await store.delete('chats', chat.id);
  res.json({ ok: true, deleted: chats.length });
}));

router.get('/api/usage', asyncHandler(async (req, res) => {
  const { limit, usage, remaining, resetAt } = await checkUsage(req);
  res.json({
    plan: req.user?.plan || 'guest',
    used: usage.messages,
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    limit,
    remaining: remaining === Infinity ? null : remaining,
    resetAt,
    dailyLimit: dailyLimitFor(req),
    resetLabel: nextReset(),
  });
}));

module.exports = router;
