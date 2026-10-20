'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT, '.env') });

const env = process.env;

function str(name, fallback = '') {
  const v = env[name];
  if (v === undefined || v === null) return fallback;
  const t = String(v).trim();
  return t === '' ? fallback : t;
}
function int(name, fallback) {
  const n = Number.parseInt(env[name], 10);
  return Number.isFinite(n) ? n : fallback;
}
function bool(name, fallback = false) {
  const v = str(name, '').toLowerCase();
  if (v === '') return fallback;
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(v);
}
function list(name) {
  return str(name, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeSecret(name, fallbackSecret) {
  const value = str(name, '');
  if (value.length >= 32) return value;
  if (fallbackSecret) return fallbackSecret;
  const generated = crypto.randomBytes(48).toString('base64url');
  console.warn(`[config] ${name} غير مهيأ — استُخدم مفتاح مؤقت. عيّنه في .env لاستقرار الجلسات.`);
  return generated;
}

const sessionSecret = safeSecret('SESSION_SECRET');
const csrfSecret = str('CSRF_TOKEN_SECRET', '') || crypto.createHmac('sha256', sessionSecret).update('csrf').digest('hex');
const oauthStateSecret = str('OAUTH_STATE_SECRET', '') || crypto.createHmac('sha256', sessionSecret).update('oauth').digest('hex');

const geminiBase = (str('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com')).replace(/\/+$/, '');
const geminiModel = str('GEMINI_MODEL', 'gemini-2.5-flash');
const geminiVision = str('GEMINI_VISION_MODEL', geminiModel);
const deepseekBase = (str('DEEPSEEK_BASE_URL', 'http://127.0.0.1:9655')).replace(/\/+$/, '');
const geminiFallback = str('GEMINI_FALLBACK_MODEL', '');
const geminiFallbackChain = list('GEMINI_FALLBACK_MODEL');
const providerEnv = str('AI_PROVIDER', '').toLowerCase();
const hasGeminiKey = Boolean(str('GEMINI_API_KEY', ''));
const provider = providerEnv === 'mock' ? 'mock' : providerEnv === 'gemini' ? 'gemini' : hasGeminiKey ? 'gemini' : 'mock';

const storageDir = path.resolve(ROOT, str('STORAGE_DIR', './data'));
const logFile = path.resolve(ROOT, str('ANTI_CLI_LOG_FILE', 'security_logs/anti-cli-rejections.log'));

const publicUrl = str('PUBLIC_URL', '').replace(/\/+$/, '');
const mainUrl = str('MAIN_URL', '').replace(/\/+$/, '');
const appUrl = str('APP_URL', '') || mainUrl || publicUrl;

const premiumPrice = str('STRIPE_PREMIUM_PRICE_ID', '');
const proPrice = str('STRIPE_PRO_PRICE_ID', '');

const config = {
  root: ROOT,
  publicDir: path.join(ROOT, 'public'),
  storageDir,
  env: str('NODE_ENV', 'development'),
  isProd: str('NODE_ENV', 'development') === 'production',
  port: int('PORT', 4000),
  host: str('HOST', '0.0.0.0'),
  trustProxy: int('TRUST_PROXY', 1),
  version: require(path.join(ROOT, 'package.json')).version,
  appUrl,
  publicUrl,
  mainUrl,
  session: {
    secret: sessionSecret,
    csrfSecret,
    oauthStateSecret,
    cookieName: str('SESSION_COOKIE_NAME', 'cosmos_sid'),
    csrfCookie: str('CSRF_COOKIE_NAME', 'cosmos_csrf'),
    maxAge: int('SESSION_MAX_AGE', 7776000000),
    secure: bool('ENABLE_SECURE_COOKIES', true),
    sameSite: 'lax',
  },
  limits: {
    maxFileSize: int('MAX_FILE_SIZE', 52428800),
    maxFileCount: int('MAX_FILE_COUNT', 5),
    maxBodySize: str('MAX_BODY_SIZE', '25mb'),
    freeDaily: int('FREE_DAILY_MESSAGES', 40),
    guestDaily: int('GUEST_DAILY_MESSAGES', 15),
    premiumDaily: int('PREMIUM_DAILY_MESSAGES', 0),
    globalWindowMs: int('RATE_LIMIT_GLOBAL_WINDOW_MS', 60000),
    globalMax: int('RATE_LIMIT_GLOBAL_MAX', 40),
    pageMax: int('RATE_LIMIT_PAGE_MAX', 30),
    chatWindowMs: int('RATE_LIMIT_CHAT_WINDOW_MS', 3600000),
    chatMax: int('RATE_LIMIT_CHAT_MAX_REQUESTS', 500),
    authWindowMs: int('RATE_LIMIT_AUTH_WINDOW_MS', 900000),
    authMax: int('RATE_LIMIT_AUTH_MAX_REQUESTS', 90),
    chatMaxMessages: 250,
    chatMaxBytes: 350000,
  },
  ai: {
    provider,
    hasKey: hasGeminiKey,
    apiKey: str('GEMINI_API_KEY', ''),
    baseUrl: geminiBase,
    model: geminiModel,
    visionModel: geminiVision,
    fallbackModel: geminiFallbackChain[0] || geminiFallback,
    fallbackModels: geminiFallbackChain,
    imageModel: str('GEMINI_IMAGE_MODEL', ''),
    timeoutMs: int('GEMINI_TIMEOUT_MS', 120000),
    demoFallback: bool('DEMO_FALLBACK', true),
    systemPrompt: str('SYSTEM_PROMPT', ''),
  },
  photon: {
    baseUrl: deepseekBase,
    apiKey: str('DEEPSEEK_API_KEY', ''),
    model: str('DEEPSEEK_MODEL', 'deepseek-chat'),
    visionModel: str('DEEPSEEK_VISION_MODEL', 'deepseek-flash'),
    timeoutMs: int('DEEPSEEK_TIMEOUT_MS', 120000),
    healthPath: str('DEEPSEEK_HEALTH_PATH', '/v1/models'),
    healthTimeoutMs: int('DEEPSEEK_HEALTH_TIMEOUT_MS', 1500),
    resetSession: bool('DEEPSEEK_RESET_SESSION', true),
    autostart: bool('DEEPSEEK_AUTOSTART', false),
    startCommand: str('DEEPSEEK_START_COMMAND', ''),
    startWaitMs: int('DEEPSEEK_START_WAIT_MS', 12000),
  },
  db: {
    host: str('DB_HOST', ''),
    port: int('DB_PORT', 5432),
    user: str('DB_USER', ''),
    password: str('DB_PASSWORD', ''),
    database: str('DB_NAME', ''),
    ssl: bool('DB_SSL', false),
    timeoutMs: Math.min(int('DB_CONNECTION_TIMEOUT', 10000), 4000),
    maxClients: int('DB_MAX_CLIENTS', 5),
    idleTimeoutMs: int('DB_IDLE_TIMEOUT', 30000),
  },
  redisUrl: str('REDIS_URL', ''),
  google: {
    clientId: str('GOOGLE_OAUTH_CLIENT_ID', ''),
    clientSecret: str('GOOGLE_OAUTH_CLIENT_SECRET', ''),
    redirectUri: str('GOOGLE_OAUTH_REDIRECT_URI', ''),
  },
  email: {
    enabled: bool('EMAIL_ENABLED', true) && Boolean(str('EMAIL_USER', '') && str('EMAIL_PASSWORD', '')),
    host: str('EMAIL_SMTP_HOST', 'smtp.gmail.com'),
    port: int('EMAIL_SMTP_PORT', 465),
    user: str('EMAIL_USER', ''),
    pass: str('EMAIL_PASSWORD', '').replace(/\s+/g, ''),
    fromName: str('EMAIL_FROM_NAME', 'Cosmos'),
    fromAddr: str('EMAIL_FROM_ADDR', str('EMAIL_USER', '')),
    adminEmail: str('ADMIN_EMAIL', str('EMAIL_FROM_ADDR', str('EMAIL_USER', ''))),
  },
  stripe: {
    secretKey: str('STRIPE_SECRET_KEY', ''),
    publishableKey: str('STRIPE_PUBLISHABLE_KEY', ''),
    webhookSecret: str('STRIPE_WEBHOOK_SECRET', ''),
    currency: str('STRIPE_CURRENCY', 'usd'),
    plans: {
      premium: {
        id: 'premium',
        name: 'Premium',
        price: 4.99,
        priceId: premiumPrice,
        tagline: 'للاستخدام اليومي الجاد',
        features: ['رسائل غير محدودة عمليًا', 'نماذج أسرع وأقوى', 'سياق أطول للمحادثة', 'دعم أولوية'],
      },
      pro: {
        id: 'pro',
        name: 'Pro',
        price: 11.99,
        priceId: proPrice,
        tagline: 'للمحترفين والفرق الصغيرة',
        features: ['كل مزايا Premium', 'حدود أعلى للصور والملفات', 'وضع الكود المتقدم', 'دعم مخصص'],
      },
    },
  },
  oauth: {
    googleConfigured: Boolean(str('GOOGLE_OAUTH_CLIENT_ID', '') && str('GOOGLE_OAUTH_CLIENT_SECRET', '')),
    facebookConfigured: Boolean(str('FACEBOOK_APP_ID', '') && str('FACEBOOK_APP_SECRET', '')),
  },
  captcha: {
    secret: str('HCAPTCHA_SECRET_KEY', ''),
    siteKey: str('HCAPTCHA_SITE_KEY', ''),
    enforce: bool('ENFORCE_CAPTCHA', false),
  },
  admin: {
    enabled: bool('ADMIN_ENABLED', true),
    secret: str('RESTRICTION_ADMIN_SECRET', ''),
  },
  antiCli: {
    mode: str('ANTI_CLI_MODE', 'strict').toLowerCase(),
    disabled: bool('ANTI_CLI_DISABLE', false),
    logFile,
    honeypots: list('ANTI_CLI_HONEYPOT_PREFIXES').length ? list('ANTI_CLI_HONEYPOT_PREFIXES') : ['/__/', '/x/', '/dev-only/'],
    loopbackWhitelist: bool('ANTI_CLI_LOOPBACK_WHITELIST', true),
    allowedOrigins: list('ANTI_CLI_ALLOWED_ORIGINS'),
    blockTtlMs: int('ANTI_CLI_BLOCK_TTL_MS', 3600000),
    slowDown: bool('ANTI_CLI_SLOWDOWN_ENABLE', false),
    slowDownMs: int('ANTI_CLI_SLOWDOWN_MS', 5000),
  },
  allowedOrigins: Array.from(new Set([
    ...list('ALLOWED_ORIGINS'),
    ...list('ANTI_CLI_ALLOWED_ORIGINS'),
    mainUrl,
    publicUrl,
  ].filter(Boolean))),
  apiKeys: list('API_KEYS').concat(str('COSMOS_API_KEY', '') ? [str('COSMOS_API_KEY', '')] : []),
  demoMode: bool('DEMO_MODE', false),
  features: {
    email: bool('EMAIL_ENABLED', true) && Boolean(str('EMAIL_USER', '') && str('EMAIL_PASSWORD', '')),
    captcha: Boolean(str('HCAPTCHA_SECRET_KEY', '')) && Boolean(str('HCAPTCHA_SITE_KEY', '')),
    ads: str('AD_NETWORK_PROVIDER', '') !== '',
    push: Boolean(str('VAPID_PUBLIC_KEY', '') && str('VAPID_PRIVATE_KEY', '')),
  },
};

fs.mkdirSync(config.storageDir, { recursive: true });
fs.mkdirSync(path.dirname(config.antiCli.logFile), { recursive: true });

module.exports = config;
