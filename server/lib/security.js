'use strict';

const fs = require('node:fs');
const path = require('node:path');
const helmet = require('helmet');
const config = require('../config');
const { timingEqual, fetchJson } = require('./util');
const { isAdmin } = require('./rate-limit');
const { logEvent } = require('./events');

/* ------------------------------ Security headers ------------------------------ */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'https:'],
      mediaSrc: ["'self'", 'data:', 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["*"],
      workerSrc: ["'self'", 'blob:'],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: false,
  hsts: config.isProd ? { maxAge: 15552000, includeSubDomains: true, preload: false } : false,
  permittedCrossDomainPolicies: false,
  originAgentCluster: true,
  dnsPrefetchControl: { allow: false },
});
helmetMiddleware.permissionsPolicy = helmet.permissionsPolicy ? helmet.permissionsPolicy({
  features: {
    camera: [],
    geolocation: [],
    microphone: ['self'],
    payment: [],
    usb: [],
  },
}) : (req, res, next) => next();

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self), payment=(), usb=()');
  res.setHeader('X-Cosmos-Api', 'v1');
  next();
}

/* ---------------------------------- CORS ----------------------------------- */
function hostOf(value) {
  if (!value) return '';
  try { return new URL(value).host; } catch { return ''; }
}

function isPreviewHost(host) {
  return /(^|\.)e2b\.app$/i.test(host) || /^localhost(:\d+)?$/i.test(host) || /^127\.0\.0\.1(:\d+)?$/i.test(host) || /^\[::1\](:\d+)?$/i.test(host);
}

function isAllowedOrigin(req, origin) {
  if (!origin) return true;
  const host = req.get('host') || '';
  const originHost = hostOf(origin);
  if (!originHost) return false;
  if (originHost === host) return true;
  if (isPreviewHost(originHost)) return true;
  if (config.allowedOrigins.some((o) => o === origin || hostOf(o) === originHost)) return true;
  return false;
}

function isOpenApiPath(path) {
  return path.startsWith('/v1/') || path === '/api/chat';
}

function cors(req, res, next) {
  const origin = req.get('origin');
  if (origin && isOpenApiPath(req.path)) {
    /* واجهة OpenAI-compatible مفتوحة للعملاء الخارجيين (بدون كوكيز) */
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, X-Cosmos-Mode');
    res.setHeader('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  }
  if (origin && isAllowedOrigin(req, origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, X-Cosmos-Mode');
    res.setHeader('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After');
    res.setHeader('Access-Control-Max-Age', '600');
  } else if (origin) {
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') return res.status(403).json({ error: { message: 'Origin غير مسموح', type: 'cors' } });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

function originGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (isOpenApiPath(req.path)) return next();
  const origin = req.get('origin');
  if (origin && !isAllowedOrigin(req, origin)) {
    return res.status(403).json({ error: { message: 'طلب من مصدر غير موثوق', type: 'origin_rejected' } });
  }
  next();
}

/* --------------------------------- CSRF ------------------------------------ */
function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const fullPath = (req.baseUrl || '') + (req.path || '');
  if (fullPath.startsWith('/api/plugins/subs/webhook') || fullPath.startsWith('/api/billing/webhook') || fullPath === '/reset-session') return next();
  if (isAdmin(req)) return next();
  const auth = req.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (token && config.apiKeys.includes(token)) return next();
  const cookies = req.headers.cookie || '';
  const get = (name) => {
    const m = cookies.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : '';
  };
  const hasSession = Boolean(get(config.session.cookieName));
  if (!hasSession && isOpenApiPath(fullPath)) return next();
  const cookieToken = get(config.session.csrfCookie);
  const headerToken = req.get('x-csrf-token') || '';
  if (cookieToken && headerToken && req.session?.csrf && cookieToken === headerToken && cookieToken === req.session.csrf) {
    return next();
  }
  return res.status(403).json({
    error: {
      message: 'رمز الحماية (CSRF) مفقود أو غير صالح. أعد تحميل الصفحة.',
      type: 'csrf_failed',
      code: 'csrf',
    },
  });
}

/* -------------------------------- Anti CLI -------------------------------- */
const CLI_PATTERNS = [
  /curl\//i, /wget\//i, /python-requests/i, /python-urllib/i, /aiohttp/i, /httpx/i,
  /node-fetch/i, /undici/i, /axios\/\d/i, /go-http-client/i, /java\/\d/i, /okhttp/i,
  /libwww-perl/i, /scrapy/i, /httpie/i, /postmanruntime/i, /insomnia/i, /powershell/i,
  /winhttp/i, /headlesschrome/i, /phantomjs/i, /selenium/i, /puppeteer/i, /playwright/i,
  /^$/,
];
let logChain = Promise.resolve();
function appendSecurityLog(entry) {
  logChain = logChain.then(async () => {
    try {
      await fs.promises.mkdir(path.dirname(config.antiCli.logFile), { recursive: true });
      try {
        const st = await fs.promises.stat(config.antiCli.logFile);
        if (st.size > 5 * 1024 * 1024) {
          await fs.promises.rename(config.antiCli.logFile, `${config.antiCli.logFile}.1`);
        }
      } catch { /* file missing */ }
      await fs.promises.appendFile(config.antiCli.logFile, JSON.stringify(entry) + '\n', 'utf8');
    } catch (err) {
      console.warn('[security] تعذّر كتابة سجل الحماية:', err.message);
    }
  }).catch(() => {});
}
function isLoopback(ip = '') {
  const clean = String(ip).replace(/^::ffff:/, '');
  return clean === '::1' || clean === '127.0.0.1' || clean.startsWith('127.') || clean === 'localhost';
}
const EXEMPT_PATHS = ['/api/health', '/api/plugins/subs/webhook', '/api/billing/webhook'];

function antiCli(req, res, next) {
  if (config.antiCli.disabled || config.antiCli.mode === 'off') return next();
  if (req.method === 'OPTIONS') return next();
  if (EXEMPT_PATHS.some((p) => req.path.startsWith(p))) return next();
  const auth = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim() || String(req.get('x-api-key') || '').trim();
  if (auth && config.apiKeys.includes(auth)) return next();
  const honeypot = config.antiCli.honeypots.some((p) => p && req.path.startsWith(p));
  const ua = String(req.get('user-agent') || '');
  const suspicious = honeypot || CLI_PATTERNS.some((re) => re.test(ua)) || (!ua && !req.path.startsWith('/api'));
  if (!suspicious) return next();
  if (config.antiCli.loopbackWhitelist && isLoopback(req.ip)) return next();
  const entry = { at: new Date().toISOString(), ip: req.ip, method: req.method, path: req.path, ua: ua.slice(0, 200), honeypot, mode: config.antiCli.mode };
  appendSecurityLog(entry);
  logEvent('anti_cli_block', { path: req.path, ip: req.ip, honeypot }).catch(() => {});
  if (config.antiCli.mode === 'monitor') return next();
  if (honeypot) return res.status(404).type('text/plain').send('Not Found');
  const wantsJson = req.path.startsWith('/api') || req.path.startsWith('/v1') || String(req.get('accept') || '').includes('application/json');
  if (wantsJson) {
    return res.status(403).json({
      error: {
        message: 'الوصول البرمجي المباشر محظور. استخدم مفتاح API أو واجهة الويب.',
        type: 'anti_cli',
        code: 'cli_blocked',
      },
    });
  }
  return res.status(403).type('html').send('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>403</title><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#111;color:#eee"><div><h1>403</h1><p>الوصول محظور.</p></div></body></html>');
}

/* ------------------------------ Threat lists ------------------------------ */
const threat = {
  ips: new Set(),
  cidrs: [],
  updatedAt: null,
  file: path.resolve(config.root, process.env.ANTI_CLI_IP_BLOCKLIST || 'security_logs/ip-blocklist.txt'),
};

function parseList(content) {
  const ips = new Set();
  const cidrs = [];
  for (const raw of String(content).split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const [addr, bits] = line.split('/');
    if (bits !== undefined && /^\d+$/.test(bits)) {
      const n = Number(bits);
      if (n >= 0 && n <= 32) cidrs.push({ addr, bits: n });
    } else if (addr) ips.add(addr.replace(/^::ffff:/, ''));
  }
  return { ips, cidrs };
}
function ipv4ToInt(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p) || Number(p) > 255) return null;
    out = (out << 8) + Number(p);
  }
  return out >>> 0;
}
function inCidr(ip, cidr) {
  const a = ipv4ToInt(ip);
  const b = ipv4ToInt(cidr.addr);
  if (a === null || b === null) return false;
  const mask = cidr.bits === 0 ? 0 : (0xffffffff << (32 - cidr.bits)) >>> 0;
  return (a & mask) === (b & mask);
}
async function loadThreatList() {
  try {
    if (!fs.existsSync(threat.file)) return;
    const { ips, cidrs } = parseList(await fs.promises.readFile(threat.file, 'utf8'));
    threat.ips = ips;
    threat.cidrs = cidrs;
    threat.updatedAt = new Date().toISOString();
  } catch (err) {
    console.warn('[security] قائمة الحجب:', err.message);
  }
}
function isThreatIp(ip) {
  const clean = String(ip).replace(/^::ffff:/, '');
  if (threat.ips.has(clean)) return true;
  return threat.cidrs.some((c) => inCidr(clean, c));
}
function threatGuard(req, res, next) {
  if (isThreatIp(req.ip)) {
    logEvent('threat_ip_block', { ip: req.ip, path: req.path }).catch(() => {});
    if (req.path.startsWith('/api') || req.path.startsWith('/v1')) {
      return res.status(403).json({ error: { message: 'تم حظر هذا العنوان.', type: 'ip_blocked' } });
    }
    return res.status(403).type('text/plain').send('Forbidden');
  }
  next();
}

/* ------------------------------ hCaptcha ---------------------------------- */
async function verifyCaptcha(token, ip) {
  if (!config.captcha.enforce) return { ok: true, skipped: true };
  if (!config.captcha.secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, reason: 'missing' };
  try {
    const body = new URLSearchParams({ secret: config.captcha.secret, response: String(token), remoteip: ip || '' });
    const { res, data } = await fetchJson('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }, 8000);
    return { ok: Boolean(res.ok && data?.success), reason: data?.['error-codes']?.join(',') };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

function banGuard(req, res, next) {
  try {
    const bans = require('./bans');
    const ban = bans.check({ ip: req.ip, userId: req.user?.id });
    if (ban) {
      logEvent('ban_block', { reason: ban.reason, until: ban.until, path: req.path, ip: req.ip }).catch(() => {});
      if (req.path.startsWith('/api') || req.path.startsWith('/v1')) {
        return res.status(403).json({
          error: {
            message: 'تم إيقاف الوصول إلى هذا الحساب أو العنوان مؤقتًا.',
            type: 'banned',
            until: ban.until,
          },
        });
      }
      return res.status(403).type('html').send('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>محظور</title><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#0d0d0d;color:#eee"><div style="text-align:center"><h1>الوصول موقوف</h1><p style="color:#999">تم إيقاف هذا العنوان مؤقتًا.</p></div></body></html>');
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  helmetMiddleware, securityHeaders, cors, originGuard, csrfGuard, antiCli, banGuard,
  loadThreatList, isThreatIp, threatGuard, verifyCaptcha, appendSecurityLog,
  isAllowedOrigin, isOpenApiPath, threat,
};
