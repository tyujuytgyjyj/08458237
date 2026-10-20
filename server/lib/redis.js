'use strict';

const config = require('../config');

class RedisHelper {
  constructor() {
    this.client = null;
    this.available = false;
    this.lastError = '';
    this.memory = new Map();
    this.started = false;
  }

  async init() {
    if (this.started || !config.redisUrl) return this;
    this.started = true;
    try {
      const Redis = require('ioredis');
      const client = new Redis(config.redisUrl, {
        lazyConnect: true,
        connectTimeout: 1800,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: () => null,
        showFriendlyErrorStack: false,
      });
      client.on('error', (err) => {
        this.lastError = err.message;
        if (this.available) console.warn('[redis]', err.message);
        this.available = false;
      });
      client.on('ready', () => {
        this.available = true;
        this.lastError = '';
        console.log('[redis] متصل');
      });
      client.on('end', () => { this.available = false; });
      this.client = client;
      await client.connect();
      await client.ping();
      this.available = true;
    } catch (err) {
      this.lastError = err.message;
      this.available = false;
      console.warn('[redis] غير متاح، سيُستخدم التخزين المحلي:', err.message);
      if (this.client) {
        try { this.client.disconnect(); } catch { /* ignore */ }
      }
    }
    return this;
  }

  async incrWindow(key, windowMs) {
    if (this.available && this.client) {
      try {
        const n = await this.client.incr(key);
        if (n === 1) await this.client.pexpire(key, windowMs);
        return n;
      } catch (err) {
        this.available = false;
        this.lastError = err.message;
      }
    }
    const now = Date.now();
    const entry = this.memory.get(key);
    if (!entry || entry.reset <= now) {
      this.memory.set(key, { count: 1, reset: now + windowMs });
      if (this.memory.size > 5000) {
        for (const [k, v] of this.memory) if (v.reset <= now) this.memory.delete(k);
      }
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }

  async get(key) {
    if (this.available && this.client) {
      try { return await this.client.get(key); } catch { this.available = false; }
    }
    const v = this.memory.get(key);
    return v ? v.value : null;
  }

  async set(key, value, ttlMs = 0) {
    if (this.available && this.client) {
      try {
        if (ttlMs) await this.client.set(key, value, 'PX', ttlMs);
        else await this.client.set(key, value);
        return true;
      } catch { this.available = false; }
    }
    this.memory.set(key, { value, reset: ttlMs ? Date.now() + ttlMs : Infinity });
    return true;
  }

  info() {
    return {
      configured: Boolean(config.redisUrl),
      available: this.available,
      lastError: this.lastError || undefined,
    };
  }
}

module.exports = new RedisHelper();
