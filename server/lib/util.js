'use strict';

const crypto = require('node:crypto');

const now = () => Date.now();
const iso = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function uid(bytes = 16) {
  return crypto.randomBytes(bytes).toString('base64url');
}
function dateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
function hmac(value, secret, enc = 'base64url') {
  return crypto.createHmac('sha256', secret).update(String(value)).digest(enc);
}
function timingEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
function randomCode(digits = 6) {
  const max = 10 ** digits;
  return String(crypto.randomInt(0, max)).padStart(digits, '0');
}
function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function truncate(s, n) {
  const text = String(s ?? '');
  return text.length > n ? text.slice(0, n - 1) + '…' : text;
}
function parseCookies(header = '') {
  const out = Object.create(null);
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    const raw = part.slice(i + 1).trim();
    try {
      out[k] = decodeURIComponent(raw);
    } catch {
      out[k] = raw;
    }
  }
  return out;
}
function signValue(value, secret) {
  return `${value}.${hmac(value, secret)}`;
}
function verifySigned(value, secret) {
  if (typeof value !== 'string') return null;
  const i = value.lastIndexOf('.');
  if (i <= 0) return null;
  const payload = value.slice(0, i);
  const sig = value.slice(i + 1);
  if (!timingEqual(sig, hmac(payload, secret))) return null;
  return payload;
}
function bearer(req) {
  const h = req.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}
async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const outer = options.signal;
  let timer;
  const onAbort = () => controller.abort(new Error('aborted'));
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', onAbort, { once: true });
  }
  timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { res, text, data };
  } finally {
    clearTimeout(timer);
    if (outer) outer.removeEventListener('abort', onAbort);
  }
}
function toBool(v, fallback = false) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
  return fallback;
}
function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}
function publicUser(user) {
  if (!user) return null;
  return pick(user, ['id', 'name', 'email', 'picture', 'plan', 'provider', 'createdAt', 'lastLoginAt', 'disabled']);
}
function userInitials(name, email) {
  const src = String(name || email || 'C').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

module.exports = {
  now, iso, sleep, uid, dateKey, sha256, hmac, timingEqual, randomCode, clampInt,
  escapeHtml, truncate, parseCookies, signValue, verifySigned, bearer, fetchJson,
  toBool, pick, publicUser, userInitials,
};
