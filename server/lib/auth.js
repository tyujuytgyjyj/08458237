'use strict';

const config = require('../config');
const store = require('./store');
const sessions = require('./sessions');
const { uid, iso, sha256, randomCode, timingEqual, signValue, verifySigned, truncate } = require('./util');
const { logEvent } = require('./events');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OAUTH_COOKIE = 'cosmos_oauth';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
function validEmail(email) {
  return EMAIL_RE.test(normalizeEmail(email)) && normalizeEmail(email).length <= 254;
}
function displayName(email) {
  const local = String(email || '').split('@')[0] || 'مستخدم';
  return truncate(local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), 40);
}

async function findUserByEmail(email) {
  const users = await store.find('users', { email: normalizeEmail(email) }, { limit: 1 });
  return users[0] || null;
}
async function findUserByGoogleSub(sub) {
  const users = await store.find('users', { googleSub: String(sub) }, { limit: 1 });
  return users[0] || null;
}

async function upsertUser(profile) {
  const email = normalizeEmail(profile.email);
  if (!email) throw Object.assign(new Error('البريد الإلكتروني مطلوب'), { status: 400 });
  let user = profile.googleSub ? await findUserByGoogleSub(profile.googleSub) : null;
  if (!user) user = await findUserByEmail(email);
  const nowIso = iso();
  if (!user) {
    user = {
      id: uid(16),
      email,
      name: truncate(profile.name || displayName(email), 60),
      picture: profile.picture || null,
      provider: profile.provider || 'email',
      googleSub: profile.googleSub || null,
      plan: 'free',
      createdAt: nowIso,
      lastLoginAt: nowIso,
      disabled: false,
      prefs: {},
    };
  } else {
    user = {
      ...user,
      email,
      name: user.name || truncate(profile.name || displayName(email), 60),
      picture: profile.picture || user.picture || null,
      provider: profile.provider || user.provider,
      googleSub: profile.googleSub || user.googleSub || null,
      lastLoginAt: nowIso,
    };
  }
  await store.set('users', user.id, user);
  return user;
}

async function migrateGuestChats(guestOwner, userId) {
  if (!guestOwner || !guestOwner.startsWith('g:')) return 0;
  const chats = await store.find('chats', { owner: guestOwner }, { limit: 200 });
  let n = 0;
  for (const chat of chats) {
    await store.set('chats', chat.id, { ...chat, owner: `u:${userId}`, ownerUserId: userId, updatedAt: iso() });
    n += 1;
  }
  return n;
}

async function signIn(req, res, user, { provider = 'google' } = {}) {
  const oldOwner = req.owner;
  const oldSessionId = req.session?.id;
  const session = await sessions.rotateSession(req, res, {
    userId: user.id,
    provider,
    loggedInAt: iso(),
  });
  const migrated = await migrateGuestChats(oldOwner, user.id);
  await logEvent('login', { provider, userId: user.id, email: user.email, migrated }, req);
  return { session, migrated, oldSessionId };
}

async function signOut(req, res) {
  await sessions.rotateSession(req, res, { userId: null });
  req.user = null;
  await logEvent('logout', {}, req);
}

/* --------------------------------- OAuth ---------------------------------- */
function oauthCookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.session.secure ? Boolean(req.secure || req.get('x-forwarded-proto') === 'https') : false,
    maxAge: 10 * 60 * 1000,
    path: '/',
  };
}

function safeNext(value) {
  const v = String(value || '');
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.includes('\\')) return '/';
  return v.slice(0, 300);
}

function googleRedirectUri(req) {
  if (config.google.redirectUri) return config.google.redirectUri;
  return `${req.protocol}://${req.get('host')}/auth/google/callback`;
}

function buildGoogleAuthUrl(req, res) {
  const nonce = uid(18);
  const next = safeNext(req.query.next);
  const payload = Buffer.from(JSON.stringify({ n: nonce, ts: Date.now(), next })).toString('base64url');
  const state = signValue(payload, config.session.oauthStateSecret);
  res.cookie(OAUTH_COOKIE, signValue(nonce, config.session.oauthStateSecret), oauthCookieOptions(req));
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: googleRedirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function parseCookiesSimple(header = '') {
  const out = {};
  for (const p of String(header).split(';')) {
    const i = p.indexOf('=');
    if (i < 0) continue;
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  }
  return out;
}

function verifyOAuthState(req) {
  const cookies = parseCookiesSimple(req.headers.cookie || '');
  const statePayload = verifySigned(req.query.state, config.session.oauthStateSecret);
  const cookieNonce = verifySigned(cookies[OAUTH_COOKIE], config.session.oauthStateSecret);
  if (!statePayload || !cookieNonce) return null;
  let parsed;
  try { parsed = JSON.parse(Buffer.from(statePayload, 'base64url').toString('utf8')); } catch { return null; }
  if (!parsed?.n || !timingEqual(parsed.n, cookieNonce)) return null;
  if (!parsed.ts || Date.now() - parsed.ts > 10 * 60 * 1000) return null;
  return { nonce: parsed.n, next: safeNext(parsed.next) };
}

async function exchangeGoogleCode(req) {
  const body = new URLSearchParams({
    code: String(req.query.code || ''),
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    redirect_uri: googleRedirectUri(req),
    grant_type: 'authorization_code',
  });
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokenData = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !tokenData?.access_token) {
    throw Object.assign(new Error('فشل تبادل رمز Google'), { code: 'token_exchange', status: 502, detail: tokenData?.error_description });
  }
  const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await infoRes.json().catch(() => null);
  if (!infoRes.ok || !profile?.sub) {
    throw Object.assign(new Error('فشل جلب بيانات حساب Google'), { code: 'profile', status: 502 });
  }
  if (!profile.email || profile.email_verified === false) {
    throw Object.assign(new Error('بريد Google غير موثّق'), { code: 'email_unverified', status: 403 });
  }
  return { profile, tokenData };
}

/* ------------------------------- Email login ------------------------------ */
function codeDocId(email) {
  return sha256(`email:${normalizeEmail(email)}`).slice(0, 40);
}
function hashCode(email, code) {
  return sha256(`${normalizeEmail(email)}:${code}:${config.session.csrfSecret}`);
}

async function startEmailLogin(email, { name, ip } = {}) {
  const normalized = normalizeEmail(email);
  if (!validEmail(normalized)) {
    throw Object.assign(new Error('أدخل بريدًا إلكترونيًا صالحًا'), { status: 400, code: 'invalid_email' });
  }
  const id = codeDocId(normalized);
  const existing = await store.get('codes', id);
  if (existing && existing.lastSentAt && Date.now() - new Date(existing.lastSentAt).getTime() < 45_000) {
    const wait = Math.ceil((45_000 - (Date.now() - new Date(existing.lastSentAt).getTime())) / 1000);
    throw Object.assign(new Error(`انتظر ${wait} ثانية قبل طلب رمز جديد.`), { status: 429, code: 'code_cooldown', retryAfter: wait });
  }
  const code = randomCode(6);
  const doc = {
    id,
    email: normalized,
    codeHash: hashCode(normalized, code),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    createdAt: iso(),
    lastSentAt: iso(),
    attempts: 0,
    ip: ip || null,
  };
  await store.set('codes', id, doc);
  const user = await findUserByEmail(normalized);
  return { code, doc, user, name: name || user?.name || displayName(normalized) };
}

async function verifyEmailLogin(email, code, req, res) {
  const normalized = normalizeEmail(email);
  if (!validEmail(normalized) || !/^\d{6}$/.test(String(code || ''))) {
    throw Object.assign(new Error('بيانات الدخول غير صحيحة'), { status: 400, code: 'invalid_input' });
  }
  const id = codeDocId(normalized);
  const doc = await store.get('codes', id);
  if (!doc) throw Object.assign(new Error('الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا.'), { status: 401, code: 'invalid_code' });
  if (doc.attempts >= 6) {
    await store.delete('codes', id);
    throw Object.assign(new Error('محاولات كثيرة على هذا الرمز. اطلب رمزًا جديدًا.'), { status: 429, code: 'too_many_attempts' });
  }
  if (new Date(doc.expiresAt).getTime() < Date.now()) {
    await store.delete('codes', id);
    throw Object.assign(new Error('انتهت صلاحية الرمز. اطلب رمزًا جديدًا.'), { status: 401, code: 'expired' });
  }
  const ok = timingEqual(hashCode(normalized, code), doc.codeHash);
  if (!ok) {
    await store.set('codes', id, { ...doc, attempts: (doc.attempts || 0) + 1 });
    throw Object.assign(new Error('الرمز غير صحيح.'), { status: 401, code: 'invalid_code' });
  }
  await store.delete('codes', id);
  const user = await upsertUser({ email: normalized, provider: 'email' });
  const result = await signIn(req, res, user, { provider: 'email' });
  return { user, ...result };
}

module.exports = {
  EMAIL_RE, validEmail, normalizeEmail, displayName, findUserByEmail, findUserByGoogleSub,
  upsertUser, migrateGuestChats, signIn, signOut, buildGoogleAuthUrl, verifyOAuthState,
  exchangeGoogleCode, googleRedirectUri, startEmailLogin, verifyEmailLogin, safeNext,
  OAUTH_COOKIE, oauthCookieOptions, sha256,
};
