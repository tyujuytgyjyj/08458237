'use strict';

const redis = require('./redis');
const config = require('../config');
const { timingEqual } = require('./util');

const ADMIN_HEADERS = ['x-admin-secret', 'x-restriction-admin-secret'];

function isAdmin(req) {
  if (!config.admin.enabled || !config.admin.secret) return false;
  for (const h of ADMIN_HEADERS) {
    const value = req.get(h);
    if (value && timingEqual(value, config.admin.secret)) return true;
  }
  return false;
}

function clientKey(req) {
  return req.user?.id ? `u:${req.user.id}` : `ip:${req.ip}`;
}

function createLimiter({ name, windowMs, max, skip, message, keyFn }) {
  const prefix = `cosmos:rl:${name}`;
  return async function limiter(req, res, next) {
    try {
      if (!max || max <= 0) return next();
      if (skip && skip(req)) return next();
      if (isAdmin(req)) return next();
      const id = keyFn ? keyFn(req) : clientKey(req);
      const bucket = Math.floor(Date.now() / windowMs);
      const key = `${prefix}:${id}:${bucket}`;
      const count = await redis.incrWindow(key, windowMs);
      const reset = (bucket + 1) * windowMs;
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - count)));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(reset / 1000)));
      if (count > max) {
        const retry = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        res.setHeader('Retry-After', String(retry));
        return res.status(429).json({
          error: {
            message: message || `طلبات كثيرة جدًا. حاول بعد ${retry} ثانية.`,
            type: 'rate_limit_exceeded',
            retry_after: retry,
          },
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

const globalLimiter = createLimiter({
  name: 'global',
  windowMs: config.limits.globalWindowMs,
  max: config.limits.globalMax,
  message: 'تم تجاوز الحد العام للطلبات. انتظر قليلًا ثم أعد المحاولة.',
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    || req.path.startsWith('/api/chats')
    || req.path === '/api/usage'
    || req.path === '/api/me'
    || req.path.startsWith('/api/billing')
    || req.path.startsWith('/api/plugins'),
});

const chatLimiter = createLimiter({
  name: 'chat',
  windowMs: config.limits.chatWindowMs,
  max: config.limits.chatMax,
  message: 'بلغت الحد الأقصى لطلبات الدردشة في هذه الساعة. جرّب لاحقًا.',
});

const authLimiter = createLimiter({
  name: 'auth',
  windowMs: config.limits.authWindowMs,
  max: config.limits.authMax,
  keyFn: (req) => `ip:${req.ip}`,
  message: 'محاولات دخول كثيرة. حاول بعد ربع ساعة.',
});

const loginCodeLimiter = createLimiter({
  name: 'login-code',
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyFn: (req) => `ip:${req.ip}`,
  message: 'طلبت رموز دخول كثيرة. حاول بعد 15 دقيقة.',
});

const adminLimiter = createLimiter({
  name: 'admin',
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyFn: (req) => `ip:${req.ip}`,
  message: 'محاولات كثيرة على لوحة الإدارة.',
});

const imageLimiter = createLimiter({
  name: 'images',
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'توليد الصور محدود بـ 30 صورة في الساعة.',
});

const feedbackLimiter = createLimiter({
  name: 'feedback',
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'أرسلت ملاحظات كثيرة. شكرًا لك، جرّب لاحقًا.',
});

const pageLimiter = createLimiter({
  name: 'page',
  windowMs: 60 * 1000,
  max: config.limits.pageMax,
  keyFn: (req) => `ip:${req.ip}`,
  message: 'طلبات كثيرة على الصفحة.',
});

module.exports = {
  createLimiter, isAdmin, clientKey, globalLimiter, chatLimiter, authLimiter,
  loginCodeLimiter, adminLimiter, imageLimiter, feedbackLimiter, pageLimiter,
};
