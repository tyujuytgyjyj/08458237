'use strict';

const express = require('express');
const config = require('../config');
const billing = require('../lib/billing');
const store = require('../lib/store');
const { asyncHandler, apiError } = require('../lib/http');
const { logEvent } = require('../lib/events');
const { publicUser } = require('../lib/util');

const router = express.Router();

router.get('/api/plans', (req, res) => {
  res.json({ plans: billing.planList(), currency: config.stripe.currency, configured: billing.configured() });
});

router.get('/api/billing/subscription', asyncHandler(async (req, res) => {
  if (!req.user) return res.json({ user: null, plan: 'guest', configured: billing.configured() });
  res.json({
    user: publicUser(req.user),
    plan: req.user.plan || 'free',
    planStatus: req.user.planStatus || null,
    currentPeriodEnd: req.user.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(req.user.cancelAtPeriodEnd),
    hasCustomer: Boolean(req.user.stripeCustomerId),
    configured: billing.configured(),
  });
}));

router.post('/api/billing/checkout', asyncHandler(async (req, res) => {
  if (!req.user || req.apiAuthed) return apiError(res, 401, 'سجّل الدخول أولًا لإتمام الاشتراك', { code: 'login_required' });
  const plan = String(req.body?.plan || '');
  const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
  try {
    const session = await billing.createCheckout({ plan, user: req.user, origin, email: req.user.email });
    await logEvent('billing_checkout', { plan, sessionId: session.id, userId: req.user.id }, req);
    res.json({ ok: true, url: session.url, id: session.id });
  } catch (err) {
    return apiError(res, err.status || 502, err.message || 'تعذّر بدء الاشتراك', { code: err.code });
  }
}));

router.post('/api/billing/sync', asyncHandler(async (req, res) => {
  if (!req.user || req.apiAuthed) return apiError(res, 401, 'سجّل الدخول أولًا', { code: 'login_required' });
  try {
    const result = await billing.syncCheckout({ sessionId: req.body?.sessionId, user: req.user });
    await logEvent('billing_sync', { plan: result.plan, userId: req.user.id }, req);
    res.json(result);
  } catch (err) {
    return apiError(res, err.status || 502, err.message || 'تعذّر التحقق من الدفع', { code: err.code });
  }
}));

router.post('/api/billing/portal', asyncHandler(async (req, res) => {
  if (!req.user || req.apiAuthed) return apiError(res, 401, 'سجّل الدخول أولًا', { code: 'login_required' });
  const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
  try {
    const session = await billing.createPortal({ user: req.user, origin });
    res.json({ ok: true, url: session.url });
  } catch (err) {
    return apiError(res, err.status || 502, err.message || 'تعذّر فتح بوابة الفوترة', { code: err.code });
  }
}));

async function webhookHandler(req, res) {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
  const signature = req.get('stripe-signature') || '';
  if (!config.stripe.webhookSecret) {
    console.warn('[stripe] webhook وصل لكن STRIPE_WEBHOOK_SECRET غير مهيأ');
    return res.status(503).json({ error: { message: 'webhook_secret_missing' } });
  }
  const check = billing.verifyWebhook(raw, signature, config.stripe.webhookSecret);
  if (!check.ok) {
    console.warn('[stripe] توقيع webhook غير صالح:', check.reason);
    await logEvent('stripe_webhook_rejected', { reason: check.reason, ip: req.ip });
    return res.status(400).json({ error: { message: 'invalid_signature', reason: check.reason } });
  }
  let event;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).json({ error: { message: 'invalid_json' } });
  }
  try {
    const result = await billing.handleEvent(event);
    await logEvent('stripe_webhook', { type: event.type, handled: result.handled, duplicate: Boolean(result.duplicate) });
    return res.json({ received: true, ...result });
  } catch (err) {
    console.error('[stripe] webhook error:', err);
    return res.status(500).json({ error: { message: 'webhook_failed' } });
  }
}

module.exports = router;
module.exports.webhookHandler = webhookHandler;
