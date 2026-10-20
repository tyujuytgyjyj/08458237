'use strict';

const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

/**
 * تخزين موحّد: PostgreSQL عند توفره، وإلا ملف JSON محلي.
 * واجهة بسيطة: get / set / update / delete / find / count / all
 */
class Store {
  constructor() {
    this.driver = 'file';
    this.filePath = path.join(config.storageDir, 'cosmos-db.json');
    this.mem = { version: 1, collections: {} };
    this.pool = null;
    this.flushTimer = null;
    this.queues = new Map();
    this.lastError = '';
  }

  async init() {
    if (config.db.host && config.db.database && config.db.user) {
      try {
        const { Pool } = require('pg');
        this.pool = new Pool({
          host: config.db.host,
          port: config.db.port,
          user: config.db.user,
          password: config.db.password,
          database: config.db.database,
          ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
          max: config.db.maxClients,
          idleTimeoutMillis: config.db.idleTimeoutMs,
          connectionTimeoutMillis: config.db.timeoutMs,
          application_name: 'cosmos-ai',
        });
        this.pool.on('error', (err) => {
          this.lastError = err.message;
          console.warn('[store] pg pool error:', err.message);
        });
        await this.pool.query('SELECT 1');
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS cosmos_docs (
            collection text NOT NULL,
            id text NOT NULL,
            data jsonb NOT NULL,
            updated_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (collection, id)
          );
          CREATE INDEX IF NOT EXISTS cosmos_docs_collection_idx ON cosmos_docs (collection);
        `);
        this.driver = 'postgres';
        console.log('[store] PostgreSQL متصل —', config.db.database);
        return this;
      } catch (err) {
        this.lastError = err.message;
        console.warn('[store] تعذّر الاتصال بـ PostgreSQL، سيُستخدم تخزين ملفات JSON:', err.message);
        if (this.pool) {
          try { await this.pool.end(); } catch { /* ignore */ }
          this.pool = null;
        }
      }
    }
    this.loadFile();
    console.log('[store] تخزين ملفات JSON —', this.filePath);
    return this;
  }

  loadFile() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.collections) this.mem = parsed;
      }
    } catch (err) {
      console.warn('[store] ملف البيانات تالف، سيتم عمل نسخة احتياطية والبدء من جديد:', err.message);
      try { fs.copyFileSync(this.filePath, `${this.filePath}.corrupt-${Date.now()}`); } catch { /* ignore */ }
      this.mem = { version: 1, collections: {} };
    }
    process.once('exit', () => this.flushSync());
  }

  col(name) {
    if (!this.mem.collections[name]) this.mem.collections[name] = {};
    return this.mem.collections[name];
  }

  scheduleFlush() {
    if (this.driver !== 'file' || this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushSync();
    }, 120);
    if (this.flushTimer.unref) this.flushTimer.unref();
  }

  flushSync() {
    if (this.driver !== 'file') return;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.mem));
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      console.warn('[store] فشل حفظ البيانات:', err.message);
    }
  }

  withQueue(key, fn) {
    const prev = this.queues.get(key) || Promise.resolve();
    const next = prev.then(fn, fn).finally(() => {
      if (this.queues.get(key) === next) this.queues.delete(key);
    });
    this.queues.set(key, next);
    return next;
  }

  async get(collection, id) {
    if (!id) return null;
    if (this.pool) {
      const { rows } = await this.pool.query(
        'SELECT data FROM cosmos_docs WHERE collection = $1 AND id = $2 LIMIT 1',
        [collection, String(id)],
      );
      return rows[0]?.data || null;
    }
    return this.col(collection)[String(id)] || null;
  }

  async set(collection, id, data) {
    if (!id) throw new Error('missing id');
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO cosmos_docs (collection, id, data)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [collection, String(id), JSON.stringify(data)],
      );
      return data;
    }
    this.col(collection)[String(id)] = data;
    this.scheduleFlush();
    return data;
  }

  async update(collection, id, updater) {
    return this.withQueue(`${collection}:${id}`, async () => {
      const current = await this.get(collection, id);
      const next = await updater(current);
      if (next === undefined || next === null) return next;
      return this.set(collection, id, next);
    });
  }

  async delete(collection, id) {
    if (this.pool) {
      await this.pool.query('DELETE FROM cosmos_docs WHERE collection = $1 AND id = $2', [collection, String(id)]);
      return;
    }
    delete this.col(collection)[String(id)];
    this.scheduleFlush();
  }

  async find(collection, filter = {}, opts = {}) {
    const limit = Math.min(Math.max(Number(opts.limit) || 1000, 1), 5000);
    if (this.pool) {
      const hasFilter = filter && Object.keys(filter).length > 0;
      const sql = hasFilter
        ? 'SELECT data FROM cosmos_docs WHERE collection = $1 AND data @> $2::jsonb ORDER BY updated_at DESC LIMIT $3'
        : 'SELECT data FROM cosmos_docs WHERE collection = $1 ORDER BY updated_at DESC LIMIT $2';
      const params = hasFilter
        ? [collection, JSON.stringify(filter), limit]
        : [collection, limit];
      const { rows } = await this.pool.query(sql, params);
      return rows.map((r) => r.data);
    }
    const values = Object.values(this.col(collection));
    const keys = Object.keys(filter || {});
    return values
      .filter((doc) => keys.every((k) => doc && doc[k] === filter[k]))
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
      .slice(0, limit);
  }

  async count(collection, filter = {}) {
    if (this.pool) {
      const hasFilter = filter && Object.keys(filter).length > 0;
      const sql = hasFilter
        ? 'SELECT count(*)::int AS n FROM cosmos_docs WHERE collection = $1 AND data @> $2::jsonb'
        : 'SELECT count(*)::int AS n FROM cosmos_docs WHERE collection = $1';
      const params = hasFilter ? [collection, JSON.stringify(filter)] : [collection];
      const { rows } = await this.pool.query(sql, params);
      return rows[0]?.n || 0;
    }
    const keys = Object.keys(filter || {});
    return Object.values(this.col(collection)).filter((doc) => keys.every((k) => doc && doc[k] === filter[k])).length;
  }

  async incrementUsage(owner, tokensIn = 0, tokensOut = 0) {
    const date = new Date().toISOString().slice(0, 10);
    const id = `${owner}:${date}`;
    return this.update('usage', id, (doc) => ({
      id,
      owner,
      date,
      messages: (doc?.messages || 0) + 1,
      tokensIn: (doc?.tokensIn || 0) + (tokensIn || 0),
      tokensOut: (doc?.tokensOut || 0) + (tokensOut || 0),
      updatedAt: new Date().toISOString(),
      createdAt: doc?.createdAt || new Date().toISOString(),
    }));
  }

  async getUsage(owner) {
    const date = new Date().toISOString().slice(0, 10);
    return (await this.get('usage', `${owner}:${date}`)) || { owner, date, messages: 0, tokensIn: 0, tokensOut: 0 };
  }

  async cleanup() {
    const sessionCutoff = Date.now() - config.session.maxAge;
    const nowIso = new Date().toISOString();
    const sessions = await this.find('sessions', {}, { limit: 5000 });
    for (const s of sessions) {
      if (!s || !s.lastSeenAt || new Date(s.lastSeenAt).getTime() < sessionCutoff) {
        await this.delete('sessions', s.id);
      }
    }
    const codes = await this.find('codes', {}, { limit: 2000 });
    for (const c of codes) {
      if (!c || !c.expiresAt || c.expiresAt < nowIso) await this.delete('codes', c.id);
    }
    const bans = await this.find('bans', {}, { limit: 2000 });
    for (const b of bans) {
      if (!b || !b.until || new Date(b.until).getTime() < Date.now()) await this.delete('bans', b.id);
    }
  }

  async close() {
    this.flushSync();
    if (this.pool) {
      try { await this.pool.end(); } catch { /* ignore */ }
    }
  }

  info() {
    return {
      driver: this.driver,
      file: this.driver === 'file' ? this.filePath : undefined,
      database: this.driver === 'postgres' ? config.db.database : undefined,
      lastError: this.lastError || undefined,
    };
  }
}

module.exports = new Store();
