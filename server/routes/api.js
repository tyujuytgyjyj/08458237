'use strict';

const express = require('express');
const fs = require('node:fs');
const config = require('../config');
const store = require('../lib/store');
const redis = require('../lib/redis');
const gemini = require('../lib/gemini');
const photon = require('../lib/photon');
const email = require('../lib/email');
const bans = require('../lib/bans');
const auth = require('../lib/auth');
const security = require('../lib/security');
const { isAdmin, imageLimiter, feedbackLimiter } = require('../lib/rate-limit');
const { asyncHandler, apiError } = require('../lib/http');
const { publicUser, iso, truncate, uid } = require('../lib/util');
const { logEvent } = require('../lib/events');
const { checkUsage } = require('../lib/usage');
const { planList } = require('../lib/billing');
const { integrationStatus } = require('./public');

const router = express.Router();

function features() {
  return {
    googleLogin: config.oauth.googleConfigured,
    facebookLogin: config.oauth.facebookConfigured,
    emailLogin: config.email.enabled || config.demoMode,
    emailDelivery: config.email.enabled ? 'smtp' : config.demoMode ? 'demo' : 'disabled',
    stripe: Boolean(config.stripe.secretKey),
    captcha: config.captcha.enforce && config.features.captcha,
    captchaSiteKey: config.captcha.enforce ? config.captcha.siteKey || null : null,
    images: Boolean(config.ai.imageModel) || gemini.isDemo() || config.ai.demoFallback,
    push: config.features.push,
    demoMode: config.demoMode,
    diagnostics: config.admin.enabled && Boolean(config.admin.secret),
  };
}

function safePrefs(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    theme: input.theme === 'light' ? 'light' : input.theme === 'dark' ? 'dark' : undefined,
    mode: ['chat', 'code', 'study', 'writing'].includes(input.mode) ? input.mode : undefined,
    language: input.language === 'en' ? 'en' : input.language === 'ar' ? 'ar' : undefined,
  };
}

router.get('/api/me', asyncHandler(async (req, res) => {
  const usage = await checkUsage(req);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    user: publicUser(req.user),
    guest: !req.user,
    accountDisabled: Boolean(req.accountDisabled),
    csrf: req.session?.csrf,
    plan: req.user?.plan || 'guest',
    usage: {
      used: usage.usage.messages,
      limit: usage.limit,
      remaining: usage.remaining === Infinity ? null : usage.remaining,
      tokensIn: usage.usage.tokensIn,
      tokensOut: usage.usage.tokensOut,
      resetAt: usage.resetAt,
    },
    preferences: req.user?.prefs || req.session?.prefs || {},
    features: features(),
    ai: { demo: gemini.isDemo() },
    limits: {
      maxFileSize: config.limits.maxFileSize,
      maxFileCount: config.limits.maxFileCount,
      freeDaily: config.limits.freeDaily,
      guestDaily: config.limits.guestDaily,
    },
    plans: planList(),
    app: { name: 'Cosmos', version: config.version, env: config.env, url: config.appUrl || null },
    integrations: integrationStatus().map(({ id, name, configured, status, detail }) => ({ id, name, configured, status, detail })),
  });
}));

router.patch('/api/me', asyncHandler(async (req, res) => {
  const prefs = safePrefs(req.body?.preferences || req.body);
  const cleanPrefs = Object.fromEntries(Object.entries(prefs).filter(([, v]) => v !== undefined));
  let user = req.user;
  if (user) {
    user = await store.update('users', user.id, (current) => {
      if (!current) return null;
      return {
        ...current,
        name: typeof req.body?.name === 'string' && req.body.name.trim() ? truncate(req.body.name.trim(), 60) : current.name,
        prefs: { ...(current.prefs || {}), ...cleanPrefs },
      };
    });
    req.user = user;
  } else {
    req.session.prefs = { ...(req.session.prefs || {}), ...cleanPrefs };
    await store.set('sessions', req.session.id, req.session);
  }
  res.json({ ok: true, user: publicUser(req.user), preferences: req.user?.prefs || req.session.prefs || {} });
}));

router.get('/api/account/export', asyncHandler(async (req, res) => {
  if (!req.user) return apiError(res, 401, 'سجّل الدخول أولًا لتصدير بياناتك');
  const chats = await store.find('chats', { owner: req.owner }, { limit: 1000 });
  const payload = {
    exportedAt: iso(),
    app: 'Cosmos',
    user: publicUser(req.user),
    chats,
  };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="cosmos-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(payload, null, 2));
}));

router.post('/api/account/delete', asyncHandler(async (req, res) => {
  if (!req.user) return apiError(res, 401, 'سجّل الدخول أولًا');
  if (String(req.body?.confirm || '') !== 'DELETE') return apiError(res, 400, 'اكتب DELETE للتأكيد');
  const userId = req.user.id;
  const chats = await store.find('chats', { owner: req.owner }, { limit: 1000 });
  for (const chat of chats) await store.delete('chats', chat.id);
  await store.delete('users', userId);
  await logEvent('account_deleted', { userId }, req);
  await auth.signOut(req, res);
  res.json({ ok: true });
}));

router.post('/api/images', imageLimiter, asyncHandler(async (req, res) => {
  const prompt = truncate(String(req.body?.prompt || '').trim(), 1000);
  if (prompt.length < 3) return apiError(res, 400, 'اكتب وصفًا أوضح للصورة (3 أحرف على الأقل)');
  if (!config.ai.imageModel && !gemini.isDemo() && !config.ai.demoFallback) {
    return apiError(res, 503, 'توليد الصور غير مهيأ على الخادم حاليًا.', { code: 'image_not_configured' });
  }
  try {
    const result = await gemini.generateImage({ prompt });
    await logEvent('image_generated', { userId: req.user?.id || null, demo: Boolean(result.demo), chars: prompt.length }, req);
    res.json({ ok: true, image: result.dataUrl, model: result.model, demo: Boolean(result.demo), text: result.text || '' });
  } catch (err) {
    console.warn('[images]', err.message);
    return apiError(res, err.status || 502, err.message || 'تعذّر توليد الصورة');
  }
}));

router.post('/api/feedback', feedbackLimiter, asyncHandler(async (req, res) => {
  const message = truncate(String(req.body?.message || '').trim(), 4000);
  const emailAddr = truncate(String(req.body?.email || '').trim(), 200);
  const name = truncate(String(req.body?.name || req.user?.name || '').trim(), 80);
  if (message.length < 3) return apiError(res, 400, 'اكتب ملاحظتك أولًا');
  if (config.captcha.enforce) {
    const captcha = await security.verifyCaptcha(req.body?.captchaToken, req.ip);
    if (!captcha.ok) return apiError(res, 400, 'فشل التحقق من hCaptcha', { code: 'captcha_failed' });
  }
  await logEvent('feedback', { message: truncate(message, 1000), email: emailAddr || null, name, userId: req.user?.id || null }, req);
  let delivered = false;
  let deliveryError = '';
  if (config.email.enabled) {
    const sent = await email.sendFeedback({ name, email: emailAddr, message, userId: req.user?.id || req.owner });
    delivered = Boolean(sent.ok);
    deliveryError = sent.error || '';
  }
  res.json({ ok: true, delivered, note: delivered ? 'وصلت ملاحظتك إلى فريق Cosmos. شكرًا لك!' : 'تم حفظ ملاحظتك على الخادم. شكرًا لك!' });
}));

router.get('/api/plugins/status', (req, res) => {
  res.json({ integrations: integrationStatus() });
});

router.get('/api/plugins/oauth/facebook/callback', (req, res) => {
  apiError(res, 503, 'تسجيل الدخول عبر Facebook غير مهيأ. أضف FACEBOOK_APP_ID وFACEBOOK_APP_SECRET.', { code: 'facebook_not_configured' });
});
router.get('/api/plugins/oauth/apple/callback', (req, res) => {
  apiError(res, 503, 'تسجيل الدخول عبر Apple غير مهيأ. أضف إعدادات APPLE_*.', { code: 'apple_not_configured' });
});

router.get('/api/diagnostics', asyncHandler(async (req, res) => {
  if (!isAdmin(req)) return apiError(res, 403, 'هذه الأداة للمشرف فقط', { code: 'admin_only' });
  const probe = req.query.probe === '1' ? await gemini.probe() : null;
  let logSize = 0;
  try { logSize = fs.statSync(config.antiCli.logFile).size; } catch { /* no log */ }
  console.info('[diagnostics] طلب تشخيص إداري — Blazar/Photon والخدمات المحلية');
  res.json({
    ok: true,
    time: iso(),
    env: config.env,
    version: config.version,
    ai: {
      demo: gemini.isDemo(),
      keyConfigured: Boolean(config.ai.hasKey),
      imageReady: Boolean(config.ai.imageModel),
      visionReady: Boolean(config.ai.visionModel),
      demoFallback: config.ai.demoFallback,
      probe: probe ? { ok: Boolean(probe.ok), latencyMs: probe.latencyMs ?? null, status: probe.status ?? null } : null,
    },
    photon: photon.diagnostics(),
    storage: { driver: store.info().driver },
    redis: { driver: redis.info().driver, connected: Boolean(redis.info().connected) },
    email: { configured: Boolean(email.info().configured), lastError: email.info().lastError || null },
    stripe: { configured: Boolean(config.stripe.secretKey), webhook: Boolean(config.stripe.webhookSecret), prices: Boolean(config.stripe.plans.premium.priceId && config.stripe.plans.pro.priceId) },
    oauth: { google: Boolean(config.oauth.googleConfigured), facebook: Boolean(config.oauth.facebookConfigured) },
    security: {
      antiCliMode: config.antiCli.disabled ? 'disabled' : config.antiCli.mode,
      logBytes: logSize,
      bans: bans.info(),
      threatList: { ips: security.threat.ips.size, cidrs: security.threat.cidrs.length, updatedAt: security.threat.updatedAt },
      captchaEnforced: config.captcha.enforce,
      trustProxy: config.trustProxy,
    },
    integrations: integrationStatus(),
  });
}));

router.post('/api/diagnostics/test-email', asyncHandler(async (req, res) => {
  if (!isAdmin(req)) return apiError(res, 403, 'هذه الأداة للمشرف فقط', { code: 'admin_only' });
  const to = String(req.body?.to || config.email.adminEmail || config.email.user || '').trim();
  if (!to) return apiError(res, 400, 'حدد بريد المستلم');
  const result = await email.send({
    to,
    subject: 'Cosmos — رسالة اختبار',
    text: 'SMTP يعمل بشكل صحيح. هذه رسالة اختبار من لوحة Cosmos.',
    html: '<div style="font-family:system-ui" dir="rtl"><h2>SMTP يعمل ✓</h2><p>هذه رسالة اختبار من لوحة Cosmos.</p></div>',
  });
  res.json({ ok: Boolean(result.ok), error: result.error || null, skipped: Boolean(result.skipped) });
}));

module.exports = router;
