'use strict';

const express = require('express');
const config = require('../config');
const store = require('../lib/store');
const redis = require('../lib/redis');
const gemini = require('../lib/gemini');
const email = require('../lib/email');
const bans = require('../lib/bans');
const security = require('../lib/security');
const { planList } = require('../lib/billing');

const router = express.Router();
const startedAt = Date.now();

function integrationStatus() {
  const demo = gemini.isDemo();
  return [
    {
      id: 'gemini',
      name: 'Gemini AI',
      configured: config.ai.hasKey && !demo,
      status: demo ? 'demo' : config.ai.hasKey ? 'ready' : 'missing_key',
      detail: demo ? 'مزوّد العرض المحلي (mock)' : config.ai.model,
      action: demo ? 'ضع GEMINI_API_KEY صالحًا في .env' : null,
    },
    {
      id: 'google',
      name: 'الدخول عبر Google',
      configured: config.oauth.googleConfigured,
      status: config.oauth.googleConfigured ? 'ready' : 'not_configured',
      detail: config.oauth.googleConfigured ? 'Client ID مهيأ' : 'أضف GOOGLE_OAUTH_CLIENT_ID/SECRET',
      action: config.oauth.googleConfigured ? 'أضف Redirect URI في Google Console' : null,
    },
    {
      id: 'email',
      name: 'بريد الدخول والتنبيهات',
      configured: config.email.enabled,
      status: config.email.enabled ? 'ready' : config.demoMode ? 'demo' : 'not_configured',
      detail: config.email.enabled ? 'SMTP جاهز' : 'غير مهيأ',
      action: null,
    },
    {
      id: 'stripe',
      name: 'اشتراكات Stripe',
      configured: Boolean(config.stripe.secretKey),
      status: config.stripe.secretKey ? 'ready' : 'not_configured',
      detail: config.stripe.secretKey ? 'Checkout جاهز' : 'أضف STRIPE_SECRET_KEY',
      action: config.stripe.webhookSecret ? null : 'أضف STRIPE_WEBHOOK_SECRET لتفعيل Webhook',
    },
    {
      id: 'database',
      name: 'قاعدة البيانات',
      configured: store.driver === 'postgres',
      status: store.driver === 'postgres' ? 'ready' : 'fallback',
      detail: store.driver === 'postgres' ? 'PostgreSQL' : 'تخزين ملفات محلي',
      action: store.driver === 'postgres' ? null : 'راجع DB_HOST/DB_PASSWORD',
    },
    {
      id: 'redis',
      name: 'Redis',
      configured: Boolean(config.redisUrl),
      status: redis.available ? 'ready' : 'fallback',
      detail: redis.available ? 'متصل' : 'تخزين مؤقت في الذاكرة',
      action: redis.available ? null : 'اختياري — لتوزيع الحدود بين النسخ',
    },
    {
      id: 'captcha',
      name: 'hCaptcha',
      configured: config.features.captcha,
      status: config.captcha.enforce ? (config.features.captcha ? 'ready' : 'missing_key') : 'optional',
      detail: config.captcha.enforce ? 'مفعّل إجباريًا' : 'اختياري / معطّل',
      action: config.features.captcha ? null : 'أضف HCAPTCHA_SITE_KEY',
    },
    {
      id: 'push',
      name: 'إشعارات Push',
      configured: config.features.push,
      status: config.features.push ? 'ready' : 'not_configured',
      detail: config.features.push ? 'VAPID مهيأ' : 'غير مهيأ',
      action: null,
    },
    {
      id: 'images',
      name: 'توليد الصور',
      configured: Boolean(config.ai.imageModel),
      status: config.ai.imageModel ? 'ready' : gemini.isDemo() ? 'demo' : 'not_configured',
      detail: config.ai.imageModel || 'أضف GEMINI_IMAGE_MODEL',
      action: config.ai.imageModel ? null : 'مثال: gemini-2.5-flash-image-preview',
    },
    {
      id: 'ads',
      name: 'شبكة الإعلانات',
      configured: config.features.ads,
      status: config.features.ads ? 'ready' : 'not_configured',
      detail: process.env.AD_NETWORK_PROVIDER || 'معطّل',
      action: null,
    },
  ];
}

router.get('/api/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    status: 'healthy',
    name: 'Cosmos',
    version: config.version,
    env: config.env,
    time: new Date().toISOString(),
    uptime: Math.round((Date.now() - startedAt) / 1000),
    ai: {
      provider: gemini.isDemo() ? 'mock' : 'gemini',
      configured: config.ai.hasKey,
      demo: gemini.isDemo(),
    },
    storage: store.driver,
  });
});

router.get('/api/status', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    app: {
      name: 'Cosmos',
      version: config.version,
      env: config.env,
      url: config.appUrl || null,
      logo: '/icons/icon-192.png',
    },
    ai: {
      provider: gemini.isDemo() ? 'mock' : 'gemini',
      demo: gemini.isDemo(),
      keyConfigured: config.ai.hasKey,
      model: config.ai.model,
      fastModel: config.ai.fastModel,
      imageModel: config.ai.imageModel || null,
      demoFallback: config.ai.demoFallback,
      models: gemini.listModels(),
    },
    features: {
      googleLogin: config.oauth.googleConfigured,
      facebookLogin: config.oauth.facebookConfigured,
      emailLogin: config.email.enabled || config.demoMode,
      emailDelivery: config.email.enabled ? 'smtp' : config.demoMode ? 'demo' : 'disabled',
      stripe: Boolean(config.stripe.secretKey),
      webhook: Boolean(config.stripe.webhookSecret),
      captcha: config.captcha.enforce && config.features.captcha,
      captchaSiteKey: config.captcha.enforce ? config.captcha.siteKey || null : null,
      push: config.features.push,
      ads: config.features.ads,
      demoMode: config.demoMode,
      images: Boolean(config.ai.imageModel) || gemini.isDemo() || config.ai.demoFallback,
      diagnostics: config.admin.enabled && Boolean(config.admin.secret),
    },
    limits: {
      maxFileSize: config.limits.maxFileSize,
      maxFileCount: config.limits.maxFileCount,
      freeDaily: config.limits.freeDaily,
      guestDaily: config.limits.guestDaily,
    },
    plans: planList(),
    integrations: integrationStatus(),
    storage: { driver: store.driver, database: store.driver === 'postgres' ? config.db.database : undefined },
    redis: { available: redis.available, configured: Boolean(config.redisUrl) },
    security: {
      antiCli: config.antiCli.disabled ? 'disabled' : config.antiCli.mode,
      bans: bans.info().active,
      threatList: security.threat.ips.size + security.threat.cidrs.length,
    },
  });
});

router.get('/api/version', (req, res) => {
  res.json({ version: config.version, name: 'Cosmos' });
});

module.exports = router;
module.exports.integrationStatus = integrationStatus;
