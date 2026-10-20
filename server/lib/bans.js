'use strict';

const store = require('./store');
const { iso } = require('./util');

const cache = new Map();
let loaded = false;
let lastLoad = 0;

function keyFor(kind, value) {
  return `${kind}:${String(value).toLowerCase()}`;
}

async function refresh(force = false) {
  if (loaded && !force && Date.now() - lastLoad < 60_000) return cache;
  try {
    const bans = await store.find('bans', {}, { limit: 5000 });
    cache.clear();
    const now = Date.now();
    for (const ban of bans) {
      if (!ban || !ban.until) continue;
      if (new Date(ban.until).getTime() < now) {
        store.delete('bans', ban.id).catch(() => {});
        continue;
      }
      cache.set(ban.id, ban);
    }
    loaded = true;
    lastLoad = Date.now();
  } catch (err) {
    console.warn('[bans]', err.message);
  }
  return cache;
}

async function add({ ip, userId, hours = 24, reason = '', by = 'admin' }) {
  const until = new Date(Date.now() + Math.min(24 * 365, Math.max(1, Number(hours) || 24)) * 3600_000).toISOString();
  const list = [];
  if (ip) list.push({ id: keyFor('ip', ip), kind: 'ip', value: ip });
  if (userId) list.push({ id: keyFor('user', userId), kind: 'user', value: userId });
  if (!list.length) throw Object.assign(new Error('حدد IP أو مستخدمًا'), { status: 400 });
  for (const item of list) {
    const ban = { ...item, until, reason: String(reason || '').slice(0, 300), createdAt: iso(), by };
    await store.set('bans', ban.id, ban);
    cache.set(ban.id, ban);
  }
  return list;
}

async function remove({ ip, userId }) {
  let n = 0;
  for (const [key, value] of [[keyFor('ip', ip), ip], [keyFor('user', userId), userId]]) {
    if (!value) continue;
    await store.delete('bans', key);
    cache.delete(key);
    n += 1;
  }
  return n;
}

function check({ ip, userId } = {}) {
  const now = Date.now();
  for (const [key, value] of [[ip ? keyFor('ip', ip) : null, ip], [userId ? keyFor('user', userId) : null, userId]]) {
    if (!key) continue;
    const ban = cache.get(key);
    if (ban && new Date(ban.until).getTime() > now) return ban;
    if (ban) cache.delete(key);
  }
  return null;
}

function list() {
  const now = Date.now();
  return [...cache.values()].filter((b) => new Date(b.until).getTime() > now);
}

function info() {
  return { active: list().length };
}

module.exports = { refresh, add, remove, check, list, info, keyFor };
