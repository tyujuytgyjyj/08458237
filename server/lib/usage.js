'use strict';

const config = require('../config');
const store = require('./store');

function dailyLimitFor(req) {
  if (req.apiAuthed) return 0;
  if (!req.user) return config.limits.guestDaily;
  if (req.user.plan === 'premium' || req.user.plan === 'pro') return config.limits.premiumDaily;
  return config.limits.freeDaily;
}

function nextReset() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString();
}

async function checkUsage(req) {
  const limit = dailyLimitFor(req);
  const usage = await store.getUsage(req.owner);
  return {
    limit,
    usage,
    remaining: limit === 0 ? Infinity : Math.max(0, limit - usage.messages),
    resetAt: nextReset(),
  };
}

module.exports = { dailyLimitFor, nextReset, checkUsage };
