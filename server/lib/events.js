'use strict';

const store = require('./store');
const { uid, iso } = require('./util');

let cache = [];
let lastPrune = 0;

async function logEvent(type, data = {}, req = null) {
  const event = {
    id: uid(8),
    type,
    at: iso(),
    ip: req ? req.ip : data.ip,
    userId: req?.user?.id || data.userId || null,
    data: { ...data },
  };
  if (req) delete event.data.ip;
  cache.unshift(event);
  cache = cache.slice(0, 200);
  try {
    await store.set('events', event.id, event);
    if (Date.now() - lastPrune > 60_000) {
      lastPrune = Date.now();
      const events = await store.find('events', {}, { limit: 1000 });
      if (events.length > 400) {
        for (const old of events.slice(400)) await store.delete('events', old.id);
      }
    }
  } catch (err) {
    console.warn('[events]', err.message);
  }
  return event;
}

async function recent(limit = 50) {
  try {
    const events = await store.find('events', {}, { limit });
    return events.length ? events : cache.slice(0, limit);
  } catch {
    return cache.slice(0, limit);
  }
}

module.exports = { logEvent, recent };
