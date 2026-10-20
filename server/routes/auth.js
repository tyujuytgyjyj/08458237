'use strict';

const express = require('express');
const config = require('../config');
const auth = require('../lib/auth');
const email = require('../lib/email');
const sessions = require('../lib/sessions');
const store = require('../lib/store');
const { logEvent } = require('../lib/events');
const { asyncHandler } = require('../lib/http');
const { apiError } = require('../lib/http');
const { loginCodeLimiter } = require('../lib/rate-limit');
const { verifyCaptcha } = require('../lib/security');
const { publicUser } = require('../lib/util');

const router = express.Router();

router.get('/auth/google', (req, res) => {
  if (!config.oauth.googleConfigured) {
    return res.redirect('/?auth=unconfigured');
  }
  try {
    const url = auth.buildGoogleAuthUrl(req, res);
    return res.redirect(url);
  } catch (err) {
    console.error('[oauth]', err);
    return res.redirect('/?auth=failed&reason=build');
  }
});

async function googleCallback(req, res) {
  const fail = (reason) => res.redirect(`/?auth=failed&reason=${encodeURIComponent(reason)}`);
  if (!config.oauth.googleConfigured) return res.redirect('/?auth=unconfigured');
  if (req.query.error) return res.redirect('/?auth=cancelled');
  if (!req.query.code || !req.query.state) return fail('missing_code');
  const state = auth.verifyOAuthState(req);
  if (!state) return fail('state');
  try {
    const { profile } = await auth.exchangeGoogleCode(req);
    const isNew = !(await auth.findUserByEmail(profile.email));
    const user = await auth.upsertUser({
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      googleSub: profile.sub,
      provider: 'google',
    });
    await auth.signIn(req, res, user, { provider: 'google' });
    res.clearCookie(auth.OAUTH_COOKIE, { path: '/' });
    if (isNew && config.email.enabled) {
      email.sendWelcome(user.email, user.name).catch(() => {});
    }
    return res.redirect(`${state.next}${state.next.includes('?') ? '&' : '?'}auth=success`);
  } catch (err) {
    console.error('[oauth]', err.message, err.detail || '');
    await logEvent('oauth_failed', { reason: err.code || 'unknown', detail: err.message }, req);
    return fail(err.code || 'exchange');
  }
}

router.get('/auth/google/callback', asyncHandler(googleCallback));
router.get('/api/plugins/oauth/google/callback', asyncHandler(googleCallback));

router.post('/api/auth/email/start', loginCodeLimiter, asyncHandler(async (req, res) => {
  const { email: rawEmail, captchaToken } = req.body || {};
  const addr = auth.normalizeEmail(rawEmail);
  if (config.captcha.enforce) {
    const captcha = await verifyCaptcha(captchaToken, req.ip);
    if (!captcha.ok) return apiError(res, 400, 'فشل التحقق من كابتشا. أعد المحاولة.', { code: 'captcha_failed' });
  }
  const started = await auth.startEmailLogin(addr, { ip: req.ip });
  const masked = addr.replace(/^(.)(.*)(@.*)$/, (m, a, b, c) => a + '*'.repeat(Math.min(6, Math.max(1, b.length))) + c);
  let delivery = 'email';
  let warning = '';
  if (!config.email.enabled) {
    if (config.demoMode) {
      delivery = 'demo';
      console.log(`[auth] DEMO login code for ${addr}: ${started.code}`);
    } else {
      await store.delete('codes', started.doc.id);
      return apiError(res, 503, 'إرسال البريد غير مهيأ على الخادم. استخدم الدخول عبر Google أو راجع إعدادات البريد.', { code: 'email_not_configured' });
    }
  } else {
    const sent = await email.sendLoginCode(addr, started.code, started.name);
    if (!sent.ok) {
      if (config.demoMode) {
        delivery = 'demo';
        warning = 'تعذّر إرسال البريد، وتم عرض الرمز لأن وضع التجربة مفعّل.';
        console.log(`[auth] DEMO login code for ${addr}: ${started.code} (email failed: ${sent.error})`);
      } else {
        await store.delete('codes', started.doc.id);
        return apiError(res, 502, 'تعذّر إرسال رسالة البريد الآن. تحقق من إعدادات SMTP أو جرّب الدخول عبر Google.', { code: 'email_send_failed' });
      }
    }
  }
  await logEvent('login_code_sent', { email: masked, delivery }, req);
  return res.json({
    ok: true,
    delivery,
    email: masked,
    expiresIn: 600,
    ...(delivery === 'demo' ? { devCode: started.code, warning } : {}),
  });
}));

router.post('/api/auth/email/verify', asyncHandler(async (req, res) => {
  const { email: addr, code } = req.body || {};
  try {
    const result = await auth.verifyEmailLogin(addr, code, req, res);
    const isNew = result.user.createdAt && Date.now() - new Date(result.user.createdAt).getTime() < 15_000;
    if (isNew && config.email.enabled) email.sendWelcome(result.user.email, result.user.name).catch(() => {});
    return res.json({ ok: true, user: publicUser(result.user), migrated: result.migrated || 0 });
  } catch (err) {
    if (!err.status) throw err;
    return apiError(res, err.status, err.message, { code: err.code, retry_after: err.retryAfter });
  }
}));

router.post('/api/auth/logout', asyncHandler(async (req, res) => {
  await auth.signOut(req, res);
  return res.json({ ok: true, csrf: req.session?.csrf });
}));

router.get('/api/auth/providers', (req, res) => {
  res.json({
    google: config.oauth.googleConfigured,
    email: config.email.enabled || config.demoMode,
    emailDelivery: config.email.enabled ? 'smtp' : config.demoMode ? 'demo' : 'disabled',
    facebook: config.oauth.facebookConfigured,
    apple: Boolean(process.env.APPLE_CLIENT_ID),
  });
});

router.get('/api/auth/google/url', (req, res) => {
  if (!config.oauth.googleConfigured) return apiError(res, 503, 'الدخول عبر Google غير مهيأ', { code: 'google_not_configured' });
  res.json({ url: auth.buildGoogleAuthUrl(req, res) });
});

module.exports = router;
