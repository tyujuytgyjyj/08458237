'use strict';

const express = require('express');
const config = require('../config');
const store = require('../lib/store');
const bans = require('../lib/bans');
const security = require('../lib/security');
const { isAdmin } = require('../lib/rate-limit');
const { asyncHandler, apiError } = require('../lib/http');
const { iso, truncate } = require('../lib/util');
const { logEvent, recent } = require('../lib/events');
const { publicUser } = require('../lib/util');

const router = express.Router();

function adminOnly(req, res, next) {
  if (!config.admin.enabled || !config.admin.secret) {
    return res.status(404).json({ error: { message: 'لوحة الإدارة غير مفعّلة', type: 'not_found' } });
  }
  if (!isAdmin(req)) {
    return res.status(401).json({ error: { message: 'مفتاح الإدارة غير صحيح', type: 'unauthorized', code: 'admin_auth' } });
  }
  next();
}
router.use('/api/admin', adminOnly);

const VALID_PLANS = ['free', 'premium', 'pro'];

router.get('/api/admin/overview', asyncHandler(async (req, res) => {
  const [users, chats] = await Promise.all([
    store.find('users', {}, { limit: 5000 }),
    store.count('chats'),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const usage = await store.find('usage', { date: today }, { limit: 5000 });
  const planCounts = { free: 0, premium: 0, pro: 0 };
  let disabled = 0;
  let newToday = 0;
  for (const u of users) {
    planCounts[u.plan] = (planCounts[u.plan] || 0) + 1;
    if (u.disabled) disabled += 1;
    if (String(u.createdAt || '').startsWith(today)) newToday += 1;
  }
  const messagesToday = usage.reduce((n, u) => n + (u.messages || 0), 0);
  const tokensIn = usage.reduce((n, u) => n + (u.tokensIn || 0), 0);
  const tokensOut = usage.reduce((n, u) => n + (u.tokensOut || 0), 0);
  const events = await recent(25);
  const [sessions, stripeEvents] = await Promise.all([
    store.count('sessions'),
    store.count('stripe_events'),
  ]);
  res.json({
    ok: true,
    time: iso(),
    users: { total: users.length, newToday, disabled, plans: planCounts },
    usage: { messagesToday, tokensIn, tokensOut, activeUsersToday: usage.length },
    chats,
    sessions,
    stripeEvents,
    bans: bans.info(),
    storage: { driver: store.driver },
    ai: { provider: config.ai.provider, demo: config.ai.provider === 'mock', model: config.ai.model },
    security: {
      antiCli: config.antiCli.disabled ? 'disabled' : config.antiCli.mode,
      threatList: security.threat.ips.size + security.threat.cidrs.length,
      captcha: config.captcha.enforce,
    },
    events,
  });
}));

router.get('/api/admin/users', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  let users = await store.find('users', {}, { limit: 5000 });
  if (q) {
    users = users.filter((u) => [u.id, u.email, u.name, u.plan, u.provider].some((v) => String(v || '').toLowerCase().includes(q)));
  }
  users.sort((a, b) => String(b.lastLoginAt || b.createdAt || '').localeCompare(String(a.lastLoginAt || a.createdAt || '')));
  const total = users.length;
  const page = users.slice(offset, offset + limit).map((u) => ({
    ...publicUser(u),
    planStatus: u.planStatus || null,
    stripeCustomerId: u.stripeCustomerId || null,
    lastLoginAt: u.lastLoginAt || null,
    planUpdatedAt: u.planUpdatedAt || null,
  }));
  res.json({ ok: true, total, offset, limit, users: page });
}));

router.get('/api/admin/users/:id', asyncHandler(async (req, res) => {
  const user = await store.get('users', req.params.id);
  if (!user) return apiError(res, 404, 'المستخدم غير موجود');
  const chats = await store.find('chats', { owner: `u:${user.id}` }, { limit: 100 });
  res.json({ ok: true, user: { ...publicUser(user), planStatus: user.planStatus, stripeCustomerId: user.stripeCustomerId, googleSub: user.googleSub }, chats: chats.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, msgCount: (c.msgs || []).length })) });
}));

router.post('/api/admin/users/:id/plan', asyncHandler(async (req, res) => {
  const plan = String(req.body?.plan || '');
  if (!VALID_PLANS.includes(plan)) return apiError(res, 400, 'خطة غير صالحة');
  const user = await store.update('users', req.params.id, (current) => {
    if (!current) return null;
    return { ...current, plan, planStatus: plan === 'free' ? 'canceled' : 'manual', planUpdatedAt: iso() };
  });
  if (!user) return apiError(res, 404, 'المستخدم غير موجود');
  await logEvent('admin_set_plan', { userId: user.id, plan }, req);
  res.json({ ok: true, user: publicUser(user) });
}));

router.post('/api/admin/users/:id/disable', asyncHandler(async (req, res) => {
  const disabled = Boolean(req.body?.disabled);
  const reason = truncate(String(req.body?.reason || ''), 300);
  const user = await store.update('users', req.params.id, (current) => {
    if (!current) return null;
    return { ...current, disabled, disabledReason: disabled ? reason : null, disabledAt: disabled ? iso() : null };
  });
  if (!user) return apiError(res, 404, 'المستخدم غير موجود');
  await logEvent(disabled ? 'admin_disable_user' : 'admin_enable_user', { userId: user.id, reason }, req);
  res.json({ ok: true, user: publicUser(user) });
}));

router.post('/api/admin/ban', asyncHandler(async (req, res) => {
  const ip = truncate(String(req.body?.ip || '').trim(), 80);
  const userId = truncate(String(req.body?.userId || '').trim(), 80);
  if (!ip && !userId) return apiError(res, 400, 'حدد IP أو معرّف مستخدم');
  const list = await bans.add({
    ip: ip || undefined,
    userId: userId || undefined,
    hours: Number(req.body?.hours) || 24,
    reason: truncate(String(req.body?.reason || ''), 300),
    by: 'admin',
  });
  await logEvent('admin_ban', { ip, userId, hours: req.body?.hours, reason: req.body?.reason }, req);
  res.json({ ok: true, bans: list });
}));

router.delete('/api/admin/ban', asyncHandler(async (req, res) => {
  const n = await bans.remove({ ip: req.query.ip, userId: req.query.userId });
  await logEvent('admin_unban', { ip: req.query.ip, userId: req.query.userId }, req);
  res.json({ ok: true, removed: n });
}));

router.get('/api/admin/bans', (req, res) => {
  res.json({ ok: true, bans: bans.list() });
});

router.post('/api/admin/blocklist/reload', asyncHandler(async (req, res) => {
  await security.loadThreatList();
  await bans.refresh(true);
  await logEvent('admin_reload_blocklist', {}, req);
  res.json({
    ok: true,
    threatList: { ips: security.threat.ips.size, cidrs: security.threat.cidrs.length, updatedAt: security.threat.updatedAt },
    bans: bans.info(),
  });
}));

router.get('/api/admin/events', asyncHandler(async (req, res) => {
  const limit = Math.min(300, Math.max(1, Number(req.query.limit) || 80));
  const events = await recent(limit);
  res.json({ ok: true, events });
}));

router.get('/api/admin/security/log', asyncHandler(async (req, res) => {
  const tail = Math.min(500, Math.max(1, Number(req.query.tail) || 80));
  const fs = require('node:fs');
  try {
    const content = await fs.promises.readFile(config.antiCli.logFile, 'utf8');
    const lines = content.trim().split(/\r?\n/).slice(-tail).map((line) => {
      try { return JSON.parse(line); } catch { return { raw: line }; }
    });
    res.json({ ok: true, entries: lines, file: config.antiCli.logFile });
  } catch (err) {
    res.json({ ok: true, entries: [], note: 'لا يوجد سجل بعد' });
  }
}));

router.get('/api/admin/export/users.csv', asyncHandler(async (req, res) => {
  const users = await store.find('users', {}, { limit: 5000 });
  const header = 'id,email,name,plan,provider,createdAt,lastLoginAt,disabled\n';
  const rows = users.map((u) => [u.id, u.email, u.name, u.plan, u.provider, u.createdAt, u.lastLoginAt, u.disabled ? 1 : 0]
    .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="cosmos-users-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('\ufeff' + header + rows);
}));

router.get('/api/admin/check', (req, res) => res.json({ ok: true, admin: true }));

module.exports = router;
