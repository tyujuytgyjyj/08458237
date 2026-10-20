'use strict';

const config = require('../config');
const store = require('./store');
const { uid, parseCookies, signValue, verifySigned, hmac } = require('./util');

const COOKIE = config.session.cookieName;
const CSRF_COOKIE = config.session.csrfCookie;

function isSecure(req) {
  return Boolean(req.secure || req.get('x-forwarded-proto') === 'https');
}

function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: config.session.sameSite,
    secure: config.session.secure ? isSecure(req) : false,
    maxAge: config.session.maxAge,
    path: '/',
  };
}

function csrfCookieOptions(req) {
  return {
    httpOnly: false,
    sameSite: config.session.sameSite,
    secure: config.session.secure ? isSecure(req) : false,
    maxAge: config.session.maxAge,
    path: '/',
  };
}

function setSessionCookie(req, res, sid) {
  const signed = signValue(sid, config.session.secret);
  res.cookie(COOKIE, signed, cookieOptions(req));
}

function clearSessionCookie(req, res) {
  res.clearCookie(COOKIE, { path: '/' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}

function verifySid(raw) {
  if (!raw) return null;
  return verifySigned(raw, config.session.secret);
}

async function loadSession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sid = verifySid(cookies[COOKIE]);
  if (!sid) return null;
  const session = await store.get('sessions', sid);
  if (!session) return null;
  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    await store.delete('sessions', sid);
    return null;
  }
  return session;
}

async function createSession(req, res, patch = {}) {
  const sid = uid(24);
  const session = {
    id: sid,
    userId: null,
    csrf: uid(24),
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    ip: req.ip,
    ua: String(req.get('user-agent') || '').slice(0, 300),
    ...patch,
  };
  await store.set('sessions', sid, session);
  setSessionCookie(req, res, sid);
  res.cookie(CSRF_COOKIE, session.csrf, csrfCookieOptions(req));
  return session;
}

async function rotateSession(req, res, patch = {}) {
  const old = req.session;
  const sid = uid(24);
  const session = {
    id: sid,
    userId: patch.userId !== undefined ? patch.userId : old?.userId || null,
    csrf: uid(24),
    createdAt: old?.createdAt || new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    ip: req.ip,
    ua: String(req.get('user-agent') || '').slice(0, 300),
    ...patch,
  };
  await store.set('sessions', sid, session);
  if (old?.id) await store.delete('sessions', old.id);
  setSessionCookie(req, res, sid);
  res.cookie(CSRF_COOKIE, session.csrf, csrfCookieOptions(req));
  req.session = session;
  return session;
}

async function middleware(req, res, next) {
  try {
    const rawCookies = parseCookies(req.headers.cookie || '');
    const cookieClient = Boolean(rawCookies[COOKIE]);
    if (!cookieClient && (req.path.startsWith('/v1/') || req.path === '/api/chat')) {
      /* عملاء OpenAI-compatible بلا كوكيز: هوية ثابتة من IP + المتصفح لتفعيل الحدود اليومية دون إنشاء جلسات */
      const anon = hmac(`${req.ip}|${req.get('user-agent') || ''}`, config.session.secret).slice(0, 32);
      req.session = { id: `anon_${anon}`, csrf: '', userId: null };
      req.owner = `g:anon_${anon}`;
      const keyUser = await apiKeyAuth(req);
      req.user = keyUser || null;
      req.apiAuthed = Boolean(keyUser);
      if (keyUser) req.owner = `k:${keyUser.id}`;
      req.isGuest = !keyUser;
      return next();
    }
    let session = await loadSession(req);
    if (!session) session = await createSession(req, res);
    else {
      res.cookie(CSRF_COOKIE, session.csrf, csrfCookieOptions(req));
      const last = new Date(session.lastSeenAt || 0).getTime();
      if (Date.now() - last > 60_000) {
        session.lastSeenAt = new Date().toISOString();
        await store.set('sessions', session.id, session);
      }
    }
    req.session = session;
    req.owner = session.userId ? `u:${session.userId}` : `g:${session.id}`;
    if (session.userId) {
      const user = await store.get('users', session.userId);
      if (user && user.disabled) {
        req.accountDisabled = true;
        req.user = null;
        req.owner = `u:${session.userId}`;
      } else if (user) {
        req.user = user;
      } else {
        session.userId = null;
        req.owner = `g:${session.id}`;
        await store.set('sessions', session.id, session);
      }
    }
    if (!req.user) req.user = null;
    const apiUser = await apiKeyAuth(req);
    if (apiUser) {
      req.user = apiUser;
      req.apiAuthed = true;
      req.owner = `k:${apiUser.id}`;
    }
    req.isGuest = !req.user;
    next();
  } catch (err) {
    next(err);
  }
}

function verifyCsrf(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  const cookies = parseCookies(req.headers.cookie || '');
  const cookieToken = cookies[CSRF_COOKIE] || '';
  const headerToken = req.get('x-csrf-token') || req.get('x-xsrf-token') || '';
  if (!cookieToken || !headerToken) return false;
  if (cookieToken !== headerToken) return false;
  return Boolean(req.session?.csrf) && cookieToken === req.session.csrf;
}

async function apiKeyAuth(req) {
  if (!config.apiKeys.length) return null;
  const auth = req.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  if (!config.apiKeys.some((k) => k.length > 8 && k === token)) return null;
  return {
    id: `api_${hmac(token, config.session.secret).slice(0, 16)}`,
    name: 'API Client',
    plan: 'pro',
    provider: 'api',
    email: null,
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  middleware, createSession, rotateSession, setSessionCookie, clearSessionCookie,
  verifyCsrf, apiKeyAuth, isSecure, COOKIE, CSRF_COOKIE,
};
