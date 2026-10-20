'use strict';

const crypto = require('node:crypto');
const config = require('../config');
const store = require('./store');
const { iso, timingEqual, truncate } = require('./util');

const API = 'https://api.stripe.com/v1';
const VALID_PLANS = ['premium', 'pro'];

class BillingError extends Error {
  constructor(message, status = 502, code = 'billing_error') {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = status < 500;
  }
}

function configured() {
  return Boolean(config.stripe.secretKey);
}

function encodeForm(value, prefix, out = []) {
  if (value === undefined || value === null) return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) => encodeForm(v, `${prefix}[${i}]`, out));
  } else if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) encodeForm(v, prefix ? `${prefix}[${k}]` : k, out);
  } else {
    out.push([prefix, String(value)]);
  }
  return out;
}

async function stripeRequest(path, { method = 'POST', body, idempotencyKey } = {}) {
  if (!configured()) throw new BillingError('الاشتراكات غير مهيأة: أضف STRIPE_SECRET_KEY.', 503, 'stripe_not_configured');
  const headers = {
    Authorization: `Bearer ${config.stripe.secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body ? new URLSearchParams(encodeForm(body, '')).toString() : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new BillingError('تعذّر الاتصال بـ Stripe. حاول لاحقًا.', 502, 'stripe_unreachable');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error?.message || `Stripe HTTP ${res.status}`;
    console.warn('[stripe]', method, path, res.status, msg);
    throw new BillingError('تعذّر إنشاء جلسة الدفع. تحقق من إعدادات Stripe.', res.status === 401 ? 503 : 502, 'stripe_error');
  }
  return data;
}

function planList() {
  return VALID_PLANS.map((id) => {
    const p = config.stripe.plans[id];
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      currency: config.stripe.currency,
      tagline: p.tagline,
      features: p.features,
      available: Boolean(config.stripe.secretKey),
    };
  });
}

async function createCheckout({ plan, user, origin, email }) {
  if (!VALID_PLANS.includes(plan)) throw new BillingError('الخطة المطلوبة غير معروفة.', 400, 'invalid_plan');
  if (!user?.id) throw new BillingError('يجب تسجيل الدخول قبل الاشتراك.', 401, 'login_required');
  if (!configured()) throw new BillingError('الاشتراكات غير مهيأة حاليًا.', 503, 'stripe_not_configured');
  const base = (origin || config.appUrl || '').replace(/\/+$/, '');
  if (!base) throw new BillingError('تعذّر تحديد رابط العودة.', 500, 'no_origin');
  const def = config.stripe.plans[plan];
  const lineItem = def.priceId
    ? { price: def.priceId, quantity: 1 }
    : {
        price_data: {
          currency: config.stripe.currency,
          unit_amount: Math.round(def.price * 100),
          recurring: { interval: 'month' },
          product_data: { name: `Cosmos ${def.name}`, description: def.tagline },
        },
        quantity: 1,
      };
  const body = {
    mode: 'subscription',
    line_items: [lineItem],
    success_url: `${base}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/?checkout=cancel`,
    client_reference_id: user.id,
    allow_promotion_codes: 'true',
    billing_address_collection: 'auto',
    metadata: { userId: user.id, plan },
    subscription_data: { metadata: { userId: user.id, plan } },
  };
  if (user.stripeCustomerId) body.customer = user.stripeCustomerId;
  else body.customer_email = email || user.email || undefined;
  const session = await stripeRequest('/checkout/sessions', {
    body,
    idempotencyKey: `cosmos-${user.id}-${plan}-${Math.floor(Date.now() / 30_000)}`,
  });
  return { id: session.id, url: session.url, plan };
}

async function createPortal({ user, origin }) {
  if (!configured()) throw new BillingError('الاشتراكات غير مهيأة حاليًا.', 503, 'stripe_not_configured');
  if (!user?.stripeCustomerId) throw new BillingError('لا يوجد اشتراك مرتبط بحسابك بعد.', 400, 'no_customer');
  const base = (origin || config.appUrl || '').replace(/\/+$/, '');
  const session = await stripeRequest('/billing_portal/sessions', {
    body: { customer: user.stripeCustomerId, return_url: `${base}/` },
  });
  return { url: session.url };
}

async function syncCheckout({ sessionId, user }) {
  if (!configured()) throw new BillingError('الاشتراكات غير مهيأة حاليًا.', 503, 'stripe_not_configured');
  if (!user?.id) throw new BillingError('يجب تسجيل الدخول.', 401, 'login_required');
  const id = String(sessionId || '').trim();
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) throw new BillingError('جلسة دفع غير صالحة.', 400, 'invalid_session');
  const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(id)}`, { method: 'GET' });
  if (session.client_reference_id !== user.id) throw new BillingError('جلسة الدفع لا تخص هذا الحساب.', 403, 'session_mismatch');
  const plan = session.metadata?.plan;
  if (!VALID_PLANS.includes(plan)) throw new BillingError('خطة غير معروفة في جلسة الدفع.', 400, 'invalid_plan');
  const paid = session.status === 'complete' || session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
  if (!paid) throw new BillingError('لم يكتمل الدفع بعد.', 409, 'checkout_incomplete');
  await updateUserPlan(user.id, {
    plan,
    planStatus: 'active',
    stripeCustomerId: session.customer || undefined,
    stripeSubscriptionId: session.subscription || undefined,
  });
  return { ok: true, plan, status: session.status };
}

function verifyWebhook(rawBody, signatureHeader, secret, toleranceSec = 300) {
  if (!secret) return { ok: false, reason: 'no_secret' };
  const sig = String(signatureHeader || '');
  const parts = Object.fromEntries(sig.split(',').map((p) => {
    const i = p.indexOf('=');
    return i > 0 ? [p.slice(0, i).trim(), p.slice(i + 1).trim()] : [p.trim(), ''];
  }));
  const timestamp = Number(parts.t);
  if (!timestamp || !parts.v1) return { ok: false, reason: 'malformed' };
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSec) return { ok: false, reason: 'expired' };
  const payload = Buffer.from(rawBody);
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(payload).digest('hex');
  if (!timingEqual(expected, parts.v1)) return { ok: false, reason: 'bad_signature' };
  return { ok: true };
}

function planFromSubscription(subscription) {
  const metaPlan = subscription?.metadata?.plan;
  if (VALID_PLANS.includes(metaPlan)) return metaPlan;
  const priceId = subscription?.items?.data?.[0]?.price?.id;
  for (const id of VALID_PLANS) {
    if (config.stripe.plans[id].priceId && config.stripe.plans[id].priceId === priceId) return id;
  }
  return null;
}

async function updateUserPlan(userId, patch) {
  if (!userId) return null;
  return store.update('users', userId, (user) => {
    if (!user) return null;
    return { ...user, ...patch, planUpdatedAt: iso() };
  });
}

async function handleEvent(event) {
  if (!event?.id || !event?.type) throw new BillingError('حدث Stripe غير صالح', 400, 'bad_event');
  const seen = await store.get('stripe_events', event.id);
  if (seen) return { duplicate: true, type: event.type };
  const result = { type: event.type, handled: false };
  const obj = event.data?.object || {};

  if (event.type === 'checkout.session.completed') {
    const userId = obj.client_reference_id || obj.metadata?.userId;
    const plan = obj.metadata?.plan;
    if (userId && VALID_PLANS.includes(plan)) {
      await updateUserPlan(userId, {
        plan,
        planStatus: 'active',
        stripeCustomerId: obj.customer || undefined,
        stripeSubscriptionId: obj.subscription || undefined,
      });
      result.handled = true;
      result.userId = userId;
      result.plan = plan;
    }
  } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const userId = obj.metadata?.userId;
    const plan = planFromSubscription(obj);
    const status = obj.status;
    if (userId && plan) {
      const active = ['active', 'trialing', 'past_due'].includes(status);
      await updateUserPlan(userId, {
        plan: active ? plan : 'free',
        planStatus: status,
        stripeCustomerId: obj.customer || undefined,
        stripeSubscriptionId: obj.id,
        currentPeriodEnd: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : undefined,
        cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end),
      });
      result.handled = true;
      result.userId = userId;
      result.plan = active ? plan : 'free';
    }
  } else if (event.type === 'customer.subscription.deleted') {
    const userId = obj.metadata?.userId;
    if (userId) {
      await updateUserPlan(userId, { plan: 'free', planStatus: 'canceled', stripeSubscriptionId: obj.id });
      result.handled = true;
      result.userId = userId;
    } else if (obj.customer) {
      const users = await store.find('users', { stripeCustomerId: obj.customer }, { limit: 1 });
      if (users[0]) {
        await updateUserPlan(users[0].id, { plan: 'free', planStatus: 'canceled', stripeSubscriptionId: obj.id });
        result.handled = true;
        result.userId = users[0].id;
      }
    }
  } else if (event.type === 'invoice.payment_failed') {
    const customer = obj.customer;
    if (customer) {
      const users = await store.find('users', { stripeCustomerId: customer }, { limit: 1 });
      if (users[0]) {
        await updateUserPlan(users[0].id, { planStatus: 'past_due' });
        result.handled = true;
      }
    }
  }

  await store.set('stripe_events', event.id, {
    id: event.id,
    type: event.type,
    at: iso(),
    handled: result.handled,
    userId: result.userId || null,
    plan: result.plan || null,
    summary: truncate(JSON.stringify(obj), 500),
  });
  return result;
}

module.exports = {
  BillingError, configured, planList, createCheckout, createPortal, syncCheckout, verifyWebhook,
  handleEvent, stripeRequest, VALID_PLANS,
};
