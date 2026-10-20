'use strict';

const path = require('node:path');
const express = require('express');
const compression = require('compression');
const config = require('./config');
const store = require('./lib/store');
const redis = require('./lib/redis');
const bans = require('./lib/bans');
const security = require('./lib/security');
const sessions = require('./lib/sessions');
const { globalLimiter, authLimiter, adminLimiter, pageLimiter } = require('./lib/rate-limit');
const { notFound, errorHandler } = require('./lib/http');
const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const apiRoutes = require('./routes/api');
const chatRoutes = require('./routes/chat');
const chatStoreRoutes = require('./routes/chats');
const adminRoutes = require('./routes/admin');
const billingRoutes = require('./routes/billing');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.set('view cache', false);

/* ------------------------------- أساسيات ------------------------------- */
app.use(security.securityHeaders);
app.use(security.helmetMiddleware);
app.use((req, res, next) => {
  // إزالة HSTS على نطاقات المعاينة المحلية لتجنّب تثبيت HTTPS عليها
  if (!config.isProd || !req.secure || /(^|\.)e2b\.app$/i.test(req.hostname) || /^(localhost|127\.0\.0\.1)$/i.test(req.hostname)) {
    res.removeHeader('Strict-Transport-Security');
  }
  next();
});
app.use(security.cors);
app.use(security.antiCli);
app.use(security.threatGuard);
app.use(compression({
  filter: (req, res) => {
    if (req.path.startsWith('/v1/chat/completions') || req.path.startsWith('/api/chat')) return false;
    const type = res.getHeader('Content-Type');
    if (type && String(type).includes('text/event-stream')) return false;
    return compression.filter(req, res);
  },
}));

/* ------------------------------ ملفات ثابتة ----------------------------- */
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(config.publicDir, 'sw.js'));
});
app.get('/favicon.ico', (req, res) => res.redirect(301, '/icons/favicon.svg'));

const staticOptions = {
  index: false,
  maxAge: config.isProd ? '1h' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
    if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
  },
};
app.use(express.static(config.publicDir, staticOptions));

/* -------------------- Webhook قبل تحليل JSON -------------------- */
app.post(['/api/billing/webhook', '/api/plugins/subs/webhook'], express.raw({ type: 'application/json', limit: '1mb' }), billingRoutes.webhookHandler);

/* ------------------------------ تحليل الطلب ----------------------------- */
app.use(express.json({ limit: config.limits.maxBodySize }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

/* ------------------------------ الجلسات والأمان ------------------------------ */
app.use(publicRoutes);
app.use(sessions.middleware);
app.use(security.originGuard);
app.use(['/api', '/v1'], security.csrfGuard);
app.use(security.banGuard);

/* -------------------------------- الحدود -------------------------------- */
app.use(['/api', '/v1'], globalLimiter);
app.use('/api/auth', authLimiter);
app.use('/auth', authLimiter);
app.use('/api/admin', adminLimiter);

/* ------------------------------ الصفحات ------------------------------ */
app.get(['/', '/index.html', '/app'], pageLimiter, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Language', 'ar');
  res.sendFile(path.join(config.publicDir, 'index.html'));
});
app.get(['/admin', '/admin/'], pageLimiter, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(config.publicDir, 'admin.html'));
});
app.get('/offline', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(config.publicDir, 'offline.html'));
});

/* ------------------------------- المسارات ------------------------------- */
app.use(authRoutes);
app.use(apiRoutes);
app.use(chatRoutes);
app.use(chatStoreRoutes);
app.use(adminRoutes);
app.use(billingRoutes);

/* ------------------------------- الأخطاء -------------------------------- */
app.use(notFound);
app.use(errorHandler);

let server = null;
let cleanupTimer = null;

async function start() {
  await redis.init();
  await store.init();
  await bans.refresh(true);
  await security.loadThreatList();
  server = app.listen(config.port, config.host, () => {
    console.log(`\n  Cosmos AI v${config.version}`);
    console.log(`  → http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
    console.log(`  → AI provider: ${config.ai.provider}${config.ai.provider === 'gemini' ? ` (${config.ai.model})` : ''}`);
    console.log(`  → Storage: ${store.driver}${store.driver === 'postgres' ? ` (${config.db.database})` : ''}`);
    console.log(`  → Env: ${config.env}\n`);
  });
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;
  cleanupTimer = setInterval(() => {
    store.cleanup().catch((err) => console.warn('[cleanup]', err.message));
    bans.refresh(true).catch(() => {});
    security.loadThreatList().catch(() => {});
    store.flushSync();
  }, 30 * 60 * 1000);
  if (cleanupTimer.unref) cleanupTimer.unref();
  return server;
}

async function shutdown(signal) {
  console.log(`\n[cosmos] إيقاف (${signal})...`);
  if (cleanupTimer) clearInterval(cleanupTimer);
  if (server) {
    await new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const force = setTimeout(() => {
        try { server.closeAllConnections(); } catch { /* ignore */ }
        finish();
      }, 5000);
      if (force.unref) force.unref();
      server.close(() => { clearTimeout(force); finish(); });
      if (server.closeIdleConnections) server.closeIdleConnections();
    });
  }
  await store.close();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM').catch(() => process.exit(1)));
process.on('SIGINT', () => shutdown('SIGINT').catch(() => process.exit(1)));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  if (config.isProd) shutdown('uncaughtException').catch(() => process.exit(1));
});

if (require.main === module) {
  start().catch((err) => {
    console.error('[cosmos] فشل الإقلاع:', err);
    process.exit(1);
  });
}

module.exports = { app, start, shutdown };
