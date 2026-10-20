/* ==========================================================================
   Cosmos — تطبيق الدردشة (Vanilla JS، بدون أي اعتماد خارجي)
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------- أيقونات --------------------------------- */
  const ICONS = {
    sparkFilled: '<path d="M12 2.4l2.85 7.05L22 12l-7.15 2.55L12 21.6l-2.85-7.05L2 12l7.15-2.55z" fill="currentColor" stroke="none"/>',
    sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sidebar: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.7" cy="8.7" r="1.6"/><path d="M21 15.5l-4.8-4.8L7 20"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    library: '<rect x="4" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><path d="M16.6 6.4l3.4 12.2"/>',
    puzzle: '<path d="M9.5 4.5a2 2 0 114 0v1h3a1 1 0 011 1v3h1a2 2 0 110 4h-1v3a1 1 0 01-1 1h-3v1a2 2 0 11-4 0v-1h-3a1 1 0 01-1-1v-3h-1a2 2 0 110-4h1v-3a1 1 0 011-1h3z"/>',
    code: '<path d="M8.5 8L4.5 12l4 4M15.5 8l4 4-4 4M13.5 5l-3 14"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06A1.7 1.7 0 0015 19.4a1.7 1.7 0 00-1 1.56V21a2 2 0 11-4 0v-.09A1.7 1.7 0 009 19.4a1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.56-1H3a2 2 0 110-4h.09A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 4.6a1.7 1.7 0 001-1.56V3a2 2 0 114 0v.09A1.7 1.7 0 0015 4.6a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0019.4 9v.09a1.7 1.7 0 001.56 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.51 1z"/>',
    star: '<path d="M12 3.2l2.7 5.6 6.1.85-4.45 4.25 1.1 6.05L12 17l-5.45 2.95 1.1-6.05L3.2 9.65l6.1-.85z"/>',
    starFilled: '<path d="M12 3.2l2.7 5.6 6.1.85-4.45 4.25 1.1 6.05L12 17l-5.45 2.95 1.1-6.05L3.2 9.65l6.1-.85z" fill="currentColor"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    chevronUpDown: '<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.2 4.2L19 6.8"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
    refresh: '<path d="M20 11a8 8 0 00-14-4L4 9M4 4v5h5M4 13a8 8 0 0014 4l2-2M20 20v-5h-5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    download: '<path d="M12 4v11M8 11l4 4 4-4M5 20h14"/>',
    mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3M9 21h6"/>',
    paperclip: '<path d="M20 11.5l-8.2 8.2a5 5 0 01-7.1-7.1l8.4-8.4a3.4 3.4 0 014.8 4.8l-8.4 8.4a1.8 1.8 0 01-2.6-2.6l7.7-7.7"/>',
    message: '<path d="M21 12a8 8 0 01-8 8H7l-4 3V12a8 8 0 018-8h2a8 8 0 018 8z"/>',
    temp: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="3.4 3.4"/><path d="M12 8v4l2.5 1.5"/>',
    activity: '<path d="M3 12h4l2.5-6 4.5 12 2.5-6H21"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    logout: '<path d="M9 5H6a2 2 0 00-2 2v10a2 2 0 002 2h3M15 8l4 4-4 4M19 12H9"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7l8.5 6 8.5-6"/>',
    google: '<path d="M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h5.1a4.4 4.4 0 01-1.9 2.9v2.4h3a9 9 0 003-6.9z" fill="currentColor" stroke="none"/><path d="M12 21c2.4 0 4.5-.8 6-2.2l-3-2.4c-.8.6-1.9 1-3 1a5.2 5.2 0 01-4.9-3.6H4v2.5A9 9 0 0012 21z" fill="currentColor" stroke="none"/><path d="M7.1 13.8a5.4 5.4 0 010-3.5V7.8H4a9 9 0 000 8.4z" fill="currentColor" stroke="none"/><path d="M12 6.6c1.3 0 2.5.5 3.4 1.4l2.6-2.6A9 9 0 004 7.8l3.1 2.5A5.2 5.2 0 0112 6.6z" fill="currentColor" stroke="none"/>',
    fileText: '<path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/>',
    send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
    edit: '<path d="M4 20h4L20 8a2.8 2.8 0 00-4-4L4 16z"/><path d="M14 6l4 4"/>',
    alert: '<path d="M12 3l9.5 17H2.5z"/><path d="M12 9v5M12 17.5v.1"/>',
    wand: '<path d="M4 20l10-10M14 4l.8 2.2L17 7l-2.2.8L14 10l-.8-2.2L11 7l2.2-.8zM19 12l.6 1.6 1.6.6-1.6.6L19 17l-.6-1.6-1.6-.6 1.6-.6zM5 4l.6 1.6L7 6l-1.4.6L5 8l-.6-1.4L3 6l1.4-.4z"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    book: '<path d="M4 5a2 2 0 012-2h13v18H6a2 2 0 01-2-2z"/><path d="M8 3v18M12 8h4M12 12h4"/>',
    chat: '<path d="M21 12a8 8 0 01-8 8H8l-5 3V12a8 8 0 018-8h2a8 8 0 018 8z"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-2 0-4.5-.5-4.5-2.5S10 3 12 8zM12 8c2 0 4.5-.5 4.5-2.5S14 3 12 8z"/>',
    external: '<path d="M14 4h6v6M20 4l-8 8M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l2 2M15 8l2 2"/>',
    creditCard: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6 15h3"/>',
    speaker: '<path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M17 9a5 5 0 010 6M19.5 6.5a9 9 0 010 11"/>',
    thumbsUp: '<path d="M7 11v10H4V11zM7 11l4-8a2 2 0 012 2v4h6a2 2 0 012 2l-1 6a2 2 0 01-2 2H7"/>',
    thumbsDown: '<g transform="rotate(180 12 12)"><path d="M7 11v10H4V11zM7 11l4-8a2 2 0 012 2v4h6a2 2 0 012 2l-1 6a2 2 0 01-2 2H7"/></g>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 018 0v3"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
    link: '<path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7L13 18"/>',
    refreshCw: '<path d="M20 11a8 8 0 00-14-4L4 9M4 4v5h5M4 13a8 8 0 0014 4l2-2M20 20v-5h-5"/>',
    play: '<path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1"/>',
    database: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  };

  function icon(name, size) {
    const s = size || 18;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.info) + '</svg>';
  }
  function paintIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
      el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 18);
      el.removeAttribute('data-icon');
    });
    (root || document).querySelectorAll('[data-logo]').forEach(function (el) {
      el.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">' + ICONS.sparkFilled + '</svg>';
      el.removeAttribute('data-logo');
    });
  }

  /* --------------------------------- أدوات --------------------------------- */
  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.from((root || document).querySelectorAll(sel)); };
  const el = function (id) { return document.getElementById(id); };
  const now = function () { return Date.now(); };
  const uid = function () { return String(now()) + Math.random().toString(36).slice(2, 6); };
  const esc = function (value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  const num = function (n) { return new Intl.NumberFormat('en-US').format(Number(n) || 0); };
  const clamp = function (n, a, b) { return Math.max(a, Math.min(b, n)); };
  const truncate = function (s, n) {
    const t = String(s || '');
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  };
  function fmtTime(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; }
  }
  function relTime(ts) {
    const diff = now() - Number(ts || 0);
    if (diff < 60_000) return 'الآن';
    if (diff < 3_600_000) return Math.round(diff / 60_000) + ' د';
    if (diff < 86_400_000) return Math.round(diff / 3_600_000) + ' س';
    if (diff < 7 * 86_400_000) return Math.round(diff / 86_400_000) + ' ي';
    return fmtDate(ts).split(',')[0] || '';
  }
  function debounce(fn, ms) {
    let timer;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }
  function getCsrf() {
    const m = document.cookie.match(/(?:^|; )cosmos_csrf=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : '';
  }
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function copyText(text) {
    const value = String(text || '');
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(value).then(function () { toast('تم النسخ إلى الحافظة'); }).catch(function () { fallbackCopy(value); });
    }
    fallbackCopy(value);
    return Promise.resolve();
  }
  function fallbackCopy(value) {
    try {
      const ta = document.createElement('textarea');
      ta.value = value; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      toast('تم النسخ إلى الحافظة');
    } catch (e) { toast('تعذّر النسخ', 'err'); }
  }
  function download(filename, content, type) {
    try {
      const blob = content instanceof Blob ? content : new Blob([content], { type: type || 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    } catch (e) { toast('تعذّر التنزيل', 'err'); }
  }

  /* --------------------------------- الحالة --------------------------------- */
  const LS = {
    settings: 'cosmos.settings.v1',
    chats: 'cosmos.chats.v2',
    notes: 'cosmos.notes.v1',
    library: 'cosmos.library.v1',
    tasks: 'cosmos.tasks.v1',
    active: 'cosmos.active.v1',
  };
  const DEFAULT_SETTINGS = {
    theme: 'dark',
    stream: true,
    history: true,
    mode: 'chat',
    model: 'cosmos-blazar-3',
    notify: false,
  };
  const FALLBACK_MODELS = [
    { id: 'cosmos-blazar-3', label: 'Cosmos Blazar 3', description: 'الأقوى — للمهام الطويلة والفهم العميق', tag: 'الرائد' },
    { id: 'cosmos-photon-3', label: 'Cosmos Photon 3', description: 'خفيف وسريع جدًا — للمهام اليومية', tag: 'سريع' },
  ];
  const MODE_LABELS = { chat: 'الدردشة', code: 'الكود', study: 'الدراسة', writing: 'الكتابة' };

  const S = {
    chats: [],
    activeId: null,
    temp: false,
    tempChat: null,
    busy: false,
    abort: null,
    recording: false,
    settings: Object.assign({}, DEFAULT_SETTINGS),
    me: null,
    status: null,
    models: [],
    usage: null,
    attachments: [],
    notes: [],
    library: [],
    tasks: [],
    logs: [],
    offline: false,
    demoToastShown: false,
    tempToastShown: false,
    lastFocus: null,
    confirmResolve: null,
    askResolve: null,
  };

  function loadState() {
    const settings = loadJSON(LS.settings, {});
    S.settings = Object.assign({}, DEFAULT_SETTINGS, settings && typeof settings === 'object' ? settings : {});
    if (!['dark', 'light'].includes(S.settings.theme)) S.settings.theme = 'dark';
    if (!['chat', 'code', 'study', 'writing'].includes(S.settings.mode)) S.settings.mode = 'chat';
    const rawChats = loadJSON(LS.chats, { chats: [] });
    const list = Array.isArray(rawChats) ? rawChats : rawChats && Array.isArray(rawChats.chats) ? rawChats.chats : [];
    S.chats = list.filter(function (c) { return c && c.id; }).map(function (c) {
      return {
        id: String(c.id),
        title: String(c.title || 'محادثة'),
        msgs: Array.isArray(c.msgs) ? c.msgs.filter(function (m) { return m && typeof m.c === 'string'; }).map(function (m) {
          return Object.assign({}, m, { pending: false });
        }) : null,
        createdAt: Number(c.createdAt) || now(),
        updatedAt: Number(c.updatedAt) || now(),
        starred: Boolean(c.starred),
        renamed: Boolean(c.renamed),
        remote: false,
      };
    });
    const active = loadJSON(LS.active, null);
    if (active && S.chats.some(function (c) { return c.id === String(active); })) S.activeId = String(active);
    const notes = loadJSON(LS.notes, []);
    S.notes = Array.isArray(notes) ? notes.filter(function (n) { return n && n.id; }) : [];
    const lib = loadJSON(LS.library, []);
    S.library = Array.isArray(lib) ? lib.filter(function (n) { return n && n.id; }) : [];
    const tasks = loadJSON(LS.tasks, []);
    S.tasks = Array.isArray(tasks) ? tasks.filter(function (t) { return t && t.id; }) : [];
    S.logs = [];
  }

  function activeChat() {
    if (S.temp) return S.tempChat;
    return S.chats.find(function (c) { return c.id === S.activeId; }) || null;
  }
  function modelMeta(id) {
    const list = S.models.length ? S.models : FALLBACK_MODELS;
    return list.find(function (m) { return m.id === id; }) || list[0];
  }
  function modelShort(id) {
    const m = modelMeta(id);
    return String(m.label || 'Cosmos').replace(/^Cosmos\s+/, '');
  }

  /* --------------------------------- السجل --------------------------------- */
  function logApi(path, status, ms, ok, note) {
    S.logs.unshift({ t: new Date().toLocaleTimeString('en-GB'), path: path, status: status, ms: ms, ok: ok, note: note || '' });
    if (S.logs.length > 80) S.logs.length = 80;
    if (el('workspace') && !el('workspace').classList.contains('hidden')) renderLog();
  }

  /* --------------------------------- الأخطاء --------------------------------- */
  function AppError(message, status, code) {
    this.name = 'AppError';
    this.message = message;
    this.status = status;
    this.code = code;
  }
  AppError.prototype = Object.create(Error.prototype);

  async function errorInfo(res) {
    let info = { message: 'HTTP ' + res.status, code: null };
    try {
      const j = await res.json();
      if (j && j.error) { info.message = j.error.message || info.message; info.code = j.error.code || null; }
      else if (j && j.message) info.message = j.message;
    } catch (e) { /* ignore */ }
    return info;
  }

  /* ---------------------------------- API ---------------------------------- */
  async function jsonApi(path, opts) {
    opts = opts || {};
    const method = opts.method || 'GET';
    const headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
    let body;
    if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
    if (!['GET', 'HEAD'].includes(method)) headers['X-CSRF-Token'] = getCsrf();
    const started = performance.now();
    let res;
    try {
      res = await fetch(path, { method: method, headers: headers, body: body, credentials: 'same-origin', signal: opts.signal });
    } catch (err) {
      logApi(path, 0, Math.round(performance.now() - started), false, 'network');
      S.offline = true;
      throw new AppError('تعذّر الاتصال بالخادم. تأكد من تشغيله أو من اتصالك بالشبكة.', 0, 'network');
    }
    const ms = Math.round(performance.now() - started);
    if (res.ok) {
      S.offline = false;
      logApi(path, res.status, ms, true);
      if (res.status === 204) return {};
      return res.json().catch(function () { return {}; });
    }
    const info = await errorInfo(res);
    logApi(path, res.status, ms, false, info.message);
    if (res.status === 403 && info.code === 'csrf' && !opts._retried) {
      try { await refreshMe(); } catch (e) { /* ignore */ }
      return jsonApi(path, Object.assign({}, opts, { _retried: true }));
    }
    throw new AppError(info.message, res.status, info.code);
  }

  async function refreshMe() {
    const data = await jsonApi('/api/me');
    S.me = data;
    S.usage = data.usage;
    if (Array.isArray(data.models) && data.models.length) S.models = data.models;
    S.settings.mode = S.settings.mode || 'chat';
    renderAccount();
    updateUsage();
    updateDemoBadge();
    if (el('profileBox')) renderProfile();
    return data;
  }

  async function refreshUsage() {
    try {
      const u = await jsonApi('/api/usage');
      S.usage = { used: u.used, limit: u.limit, remaining: u.remaining, tokensIn: u.tokensIn, tokensOut: u.tokensOut, resetAt: u.resetAt };
      updateUsage();
    } catch (e) { /* silent */ }
  }

  async function refreshStatus() {
    try {
      S.status = await jsonApi('/api/status');
      renderStatusList();
      renderIntegrations();
      if (S.status.ai && S.status.ai.demo) showDemoBadge();
      if (S.status.plans) S.me = S.me || {};
      if (el('adminLink')) el('adminLink').hidden = !(S.status.features && S.status.features.diagnostics);
      renderModelMenu();
      return S.status;
    } catch (e) {
      if (el('statusList')) el('statusList').innerHTML = '<div class="ws-empty">' + icon('alert', 24) + 'تعذّر جلب حالة الخادم<br><small>' + esc(e.message) + '</small></div>';
      throw e;
    }
  }

  async function loadModels() {
    try {
      const data = await jsonApi('/api/models');
      if (Array.isArray(data.data) && data.data.length) {
        S.models = data.data;
        renderModelMenu();
        updateModelChip();
      }
    } catch (e) { /* fallback models */ }
  }

  /* --------------------------------- الثيم --------------------------------- */
  function applyTheme() {
    document.documentElement.dataset.theme = S.settings.theme;
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute('content', S.settings.theme === 'dark' ? '#0c0c0e' : '#ffffff');
  }
  function toggleTheme() {
    S.settings.theme = S.settings.theme === 'dark' ? 'light' : 'dark';
    saveSettings();
    applyTheme();
    renderSettingsToggles();
  }
  function saveSettings() {
    saveJSON(LS.settings, S.settings);
    try { jsonApi('/api/me', { method: 'PATCH', body: { preferences: { theme: S.settings.theme, mode: S.settings.mode } } }).catch(function () {}); } catch (e) { /* ignore */ }
  }

  /* --------------------------------- التنبيهات --------------------------------- */
  function toast(message, kind, ms) {
    const host = el('toasts');
    if (!host) return;
    const node = document.createElement('div');
    node.className = 'toast' + (kind ? ' ' + kind : '');
    node.textContent = message;
    host.appendChild(node);
    setTimeout(function () {
      node.classList.add('out');
      setTimeout(function () { node.remove(); }, 220);
    }, ms || 2600);
  }

  /* --------------------------------- النوافذ --------------------------------- */
  function openModal(id) {
    closeAllModals();
    const modal = el(id);
    if (!modal) return;
    S.lastFocus = document.activeElement;
    modal.classList.add('open');
    const focusable = modal.querySelector('input:not([type=hidden]), textarea, button:not([disabled])');
    setTimeout(function () { if (focusable) focusable.focus(); }, 70);
  }
  function closeModal(id) {
    const modal = el(id);
    if (!modal) return;
    modal.classList.remove('open');
    if (S.lastFocus && S.lastFocus.focus) { try { S.lastFocus.focus(); } catch (e) { /* ignore */ } }
  }
  function closeAllModals() {
    $$('.modal.open').forEach(function (m) { m.classList.remove('open'); });
  }
  function anyModalOpen() { return Boolean($('.modal.open')); }

  function confirmDialog(options) {
    options = options || {};
    el('confirmTitle').textContent = options.title || 'تأكيد';
    el('confirmMessage').textContent = options.message || '';
    el('confirmOk').textContent = options.ok || 'تأكيد';
    el('confirmOk').className = 'btn ' + (options.danger === false ? 'primary' : 'danger');
    openModal('confirmModal');
    return new Promise(function (resolve) { S.confirmResolve = resolve; });
  }
  function finishConfirm(value) {
    el('confirmModal').classList.remove('open');
    if (S.confirmResolve) { S.confirmResolve(value); S.confirmResolve = null; }
  }
  function askText(options) {
    options = options || {};
    el('askTitle').textContent = options.title || 'تعديل';
    el('askLabel').textContent = options.label || '';
    const input = el('askInput');
    input.value = options.value || '';
    input.placeholder = options.placeholder || '';
    input.maxLength = options.maxlength || 120;
    openModal('askModal');
    setTimeout(function () { input.focus(); input.select(); }, 80);
    return new Promise(function (resolve) { S.askResolve = resolve; });
  }
  function finishAsk(value) {
    el('askModal').classList.remove('open');
    if (S.askResolve) { S.askResolve(value); S.askResolve = null; }
  }

  /* --------------------------------- Markdown --------------------------------- */
  function md(source) {
    let text = String(source || '');
    if (!text) return '';
    const codeBlocks = [];
    text = text.replace(/```([\w+.#-]*)[ \t]*\r?\n?([\s\S]*?)(?:```|$)/g, function (m, lang, code) {
      codeBlocks.push({ lang: (lang || 'code').toLowerCase(), code: code.replace(/\r?\n$/, '') });
      return '\u0000CODE' + (codeBlocks.length - 1) + '\u0000';
    });
    text = esc(text);
    text = text.replace(/`([^`\n]+)`/g, '<code class="inline">$1</code>');
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (m, label, url) {
      return '<a href="' + url.replace(/&amp;/g, '&').replace(/"/g, '&quot;') + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    });
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    const parts = text.split(/(\u0000CODE\d+\u0000)/);
    let html = '';
    parts.forEach(function (part) {
      const codeMatch = part.match(/^\u0000CODE(\d+)\u0000$/);
      if (codeMatch) {
        const block = codeBlocks[Number(codeMatch[1])];
        if (block) {
          const langLabel = block.lang === 'code' ? 'code' : block.lang;
          html += '<div class="code-block"><div class="code-head"><span class="code-lang">' + esc(langLabel) + '</span><button class="code-copy" type="button" data-codecopy>' + icon('copy', 12) + ' نسخ</button></div><pre><code>' + esc(block.code) + '</code></pre></div>';
        }
        return;
      }
      html += renderBlocks(part);
    });
    return html;
  }
  function renderBlocks(raw) {
    const lines = raw.split(/\r?\n/);
    let html = '';
    let i = 0;
    const isTableSep = function (line) { return /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.indexOf('|') >= 0; };
    const splitRow = function (line) { return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); }); };
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i += 1; continue; }
      if (/^#{1,4}\s+/.test(line)) {
        const m = line.match(/^(#{1,4})\s+(.*)$/);
        const level = Math.min(4, m[1].length);
        html += '<h' + level + '>' + m[2] + '</h' + level + '>';
        i += 1; continue;
      }
      if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) { html += '<hr>'; i += 1; continue; }
      if (/^&gt;\s?/.test(line)) {
        const quote = [];
        while (i < lines.length && /^&gt;\s?/.test(lines[i])) { quote.push(lines[i].replace(/^&gt;\s?/, '')); i += 1; }
        html += '<blockquote>' + quote.join('<br>') + '</blockquote>';
        continue;
      }
      if (line.indexOf('|') >= 0 && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        const head = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].indexOf('|') >= 0 && lines[i].trim()) { rows.push(splitRow(lines[i])); i += 1; }
        html += '<table><thead><tr>' + head.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
          rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
        continue;
      }
      if (/^\s*[-*•]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*•]\s+/, '')); i += 1; }
        html += '<ul>' + items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
        continue;
      }
      if (/^\s*\d+[.)]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i += 1; }
        html += '<ol>' + items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol>';
        continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^#{1,4}\s+/.test(lines[i]) && !/^\s*[-*•]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i]) && !/^&gt;\s?/.test(lines[i]) && !/^\s*(---+|\*\*\*+|___+)\s*$/.test(lines[i])) {
        para.push(lines[i]); i += 1;
      }
      if (para.length) html += '<p>' + para.join('<br>') + '</p>';
      else i += 1;
    }
    return html;
  }

  /* ==========================================================================
     العرض: الشريط الجانبي
     ========================================================================== */
  function sortedChats() {
    return S.chats.filter(function (c) { return !c.temp; }).sort(function (a, b) {
      return Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
    });
  }

  function chatRow(chat) {
    const active = !S.temp && chat.id === S.activeId;
    const starIcon = chat.starred ? icon('starFilled', 13) : icon('star', 13);
    return '<div class="chat-item' + (active ? ' active' : '') + '" data-chat-id="' + esc(chat.id) + '">' +
      '<a href="#" data-open-chat="' + esc(chat.id) + '" title="' + esc(chat.title) + '">' +
      (chat.starred ? '<span class="starred">' + starIcon + '</span>' : '') +
      '<span class="title">' + esc(chat.title || 'محادثة') + '</span></a>' +
      '<span class="ci-actions">' +
      '<button class="icon-btn" type="button" data-star="' + esc(chat.id) + '" title="' + (chat.starred ? 'إلغاء التثبيت' : 'تثبيت') + '">' + starIcon + '</button>' +
      '<button class="icon-btn" type="button" data-rename="' + esc(chat.id) + '" title="إعادة تسمية">' + icon('edit', 13) + '</button>' +
      '<button class="icon-btn" type="button" data-del="' + esc(chat.id) + '" title="حذف">' + icon('trash', 13) + '</button>' +
      '</span></div>';
  }

  function renderChatList() {
    const list = el('chatList');
    const pinnedHost = el('pinnedList');
    if (!list || !pinnedHost) return;
    const chats = sortedChats();
    const pinned = chats.filter(function (c) { return c.starred; });
    const recent = chats.filter(function (c) { return !c.starred; });
    el('pinnedLabel').hidden = pinned.length === 0;
    pinnedHost.innerHTML = pinned.map(chatRow).join('');
    let html = '';
    if (S.temp) {
      html += '<div class="chat-item' + (S.temp ? ' active' : '') + '"><a href="#" data-temp-chat="1"><span class="title" style="color:var(--amber)">✦ دردشة مؤقتة</span></a></div>';
    }
    if (!recent.length) html += '<div class="empty-note">لا توجد محادثات محفوظة بعد.</div>';
    else html += recent.slice(0, 80).map(chatRow).join('');
    list.innerHTML = html;
    paintIcons(list);
    paintIcons(pinnedHost);
    const count = S.library.length;
    const libCount = el('libCount');
    if (libCount) libCount.textContent = count ? String(count) : '';
  }

  function renderAccount() {
    const user = S.me && S.me.user;
    const avatar = el('sbAvatar');
    const name = el('sbName');
    const plan = el('sbPlan');
    if (avatar) {
      if (user && user.picture) avatar.innerHTML = '<img src="' + esc(user.picture) + '" alt="" referrerpolicy="no-referrer">';
      else avatar.textContent = user ? initials(user.name || user.email) : 'C';
    }
    if (name) name.textContent = user ? (user.name || user.email) : 'زائر';
    if (plan) {
      if (!user) plan.textContent = 'سجّل الدخول لحفظ محادثاتك';
      else {
        const label = user.plan === 'premium' ? 'Premium' : user.plan === 'pro' ? 'Pro' : 'مجاني';
        plan.textContent = label + (user.email ? ' · ' + user.email : '');
      }
    }
    const up = el('btnUpgrade');
    if (up) up.innerHTML = icon('sparkles', 16) + (user && user.plan !== 'free' ? ' إدارة الاشتراك' : ' احصل على Premium');
    const top = el('btnUpgradeTop');
    if (top) top.innerHTML = icon('sparkles', 14) + '<span class="offer-text"> ' + (user && user.plan !== 'free' ? 'اشتراكك' : 'Premium') + '</span>';
  }

  function initials(value) {
    const src = String(value || 'C').trim();
    const parts = src.split(/\s+/);
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return src.slice(0, 2).toUpperCase();
  }

  function updateUsage() {
    const u = S.usage;
    const chip = el('usageChip');
    const sb = el('sbUsage');
    const bar = el('sbUsageBar');
    if (!u) {
      if (chip) chip.innerHTML = icon('activity', 12) + ' <b>—</b>';
      if (sb) sb.textContent = '—';
      if (bar) bar.style.width = '0%';
      return;
    }
    const limit = Number(u.limit) || 0;
    const used = Number(u.used) || 0;
    if (chip) {
      chip.innerHTML = icon('activity', 12) + ' <b>' + num(used) + '</b> ' + (limit ? '/ ' + num(limit) + ' اليوم' : '· غير محدود');
    }
    if (sb) sb.textContent = limit ? num(used) + ' / ' + num(limit) : 'غير محدود';
    if (bar) bar.style.width = limit ? clamp((used / limit) * 100, 0, 100) + '%' : '0%';
  }

  function showDemoBadge() {
    const badge = el('demoBadge');
    if (badge) badge.classList.remove('hidden');
  }
  function updateDemoBadge() {
    const badge = el('demoBadge');
    if (!badge) return;
    const demo = Boolean((S.me && S.me.ai && S.me.ai.demo) || (S.status && S.status.ai && S.status.ai.demo) || S.demoToastShown);
    badge.classList.toggle('hidden', !demo);
    badge.innerHTML = icon('activity', 12) + ' عرض تجريبي';
  }

  /* ==========================================================================
     العرض: المحادثة
     ========================================================================== */
  function emptyHTML() {
    const suggestions = [
      { icon: 'wand', title: 'اشرح فكرة معقدة', text: 'بأسلوب بسيط وبأمثلة من الحياة', prompt: 'اشرح لي موضوعًا معقدًا بأسلوب بسيط. اسألني أولًا عن الموضوع الذي أريده.' },
      { icon: 'edit', title: 'اكتب مسودة احترافية', text: 'بريد، منشور، أو رسالة متابعة', prompt: 'اكتب لي مسودة احترافية لرسالة بريد إلكتروني قصيرة ومقنعة، ثم اقترح عنوانًا لها.' },
      { icon: 'code', title: 'اكتب كودًا معي', text: 'حل عملي مع شرح واختبار', prompt: 'ساعدني في كتابة دالة JavaScript لحل مشكلة عملية، مع شرح موجز واختبار سريع.' },
      { icon: 'image', title: 'حلّل صورة أو ملفًا', text: 'أرفق صورة، PDF، أو نصًا', attach: true },
    ];
    return '<div class="empty-state">' +
      '<div class="empty-logo">' + icon('sparkFilled', 34) + '</div>' +
      '<h1>جاهز عندما تكون جاهزًا.</h1>' +
      '<p class="lead">اسأل، اكتب، حلّل صورة، أو برمج — كل ذلك بلغتك، وفي مساحة واحدة.</p>' +
      '<div class="suggestions">' + suggestions.map(function (s) {
        return '<button class="suggestion" type="button" ' + (s.attach ? 'data-act="attach"' : 'data-prompt="' + esc(s.prompt) + '"') + '>' +
          '<span class="s-ico">' + icon(s.icon, 17) + '</span><span><b>' + s.title + '</b><span>' + s.text + '</span></span></button>';
      }).join('') + '</div>' +
      '<div class="empty-foot"><span><i class="dot"></i> مدعوم بـ Gemini</span><span><span class="dot" style="background:var(--accent)"></span> محادثاتك تبقى ملكك</span><span><span class="dot" style="background:var(--amber)"></span> نسخة إنتاج تجريبية</span></div>' +
      '</div>';
  }

  function thinkingHTML(label) {
    return '<span class="thinking"><span class="dots"><i></i><i></i><i></i></span>' + esc(label || 'جارٍ الاتصال…') + '</span>';
  }

  function attachmentsView(files) {
    const list = (files || []).filter(Boolean);
    if (!list.length) return '';
    return '<div class="attachments-view">' + list.map(function (f) {
      if (f.th || f.img) {
        const src = f.th || f.img;
        return '<div class="att-img"><img src="' + esc(src) + '" alt="' + esc(f.n || 'صورة') + '" data-zoom="' + esc(f.img || f.th) + '" loading="lazy"></div>';
      }
      return '<span class="att-file">' + icon('fileText', 14) + '<span>' + esc(f.n || 'ملف') + '</span></span>';
    }).join('') + '</div>';
  }

  function msgActions(m, i) {
    if (m.pending) return '';
    const parts = [];
    parts.push('<button class="icon-btn" type="button" data-act="copy" data-i="' + i + '" title="نسخ">' + icon('copy', 15) + '</button>');
    if (m.r === 'a') {
      parts.push('<button class="icon-btn" type="button" data-act="regen" data-i="' + i + '" title="إعادة التوليد">' + icon('refresh', 15) + '</button>');
      parts.push('<button class="icon-btn' + (m.rating === 'up' ? ' on' : '') + '" type="button" data-act="like" data-i="' + i + '" title="إعجاب">' + icon('thumbsUp', 15) + '</button>');
      parts.push('<button class="icon-btn' + (m.rating === 'down' ? ' on' : '') + '" type="button" data-act="dislike" data-i="' + i + '" title="عدم إعجاب">' + icon('thumbsDown', 15) + '</button>');
      parts.push('<button class="icon-btn" type="button" data-act="speak" data-i="' + i + '" title="استمع">' + icon('speaker', 15) + '</button>');
      parts.push('<button class="icon-btn" type="button" data-act="save" data-i="' + i + '" title="حفظ في المكتبة">' + icon('book', 15) + '</button>');
      if (m.ms) parts.push('<span class="tx">' + (m.ms / 1000).toFixed(1) + 's</span>');
    } else {
      parts.push('<button class="icon-btn" type="button" data-act="editmsg" data-i="' + i + '" title="تعديل">' + icon('edit', 15) + '</button>');
    }
    return '<div class="msg-actions">' + parts.join('') + '</div>';
  }

  function messageHTML(m, i, chat) {
    const when = fmtTime(m.at || chat.updatedAt);
    if (m.r === 'u') {
      return '<div class="msg user-msg" data-msg="' + i + '"><div class="msg-body">' +
        '<div class="msg-meta"><span class="who">أنت</span><span class="when">' + esc(when) + '</span></div>' +
        '<div class="bubble" dir="auto">' + attachmentsView(m.f) + esc(m.c) + '</div>' +
        msgActions(m, i) + '</div></div>';
    }
    const avatar = '<div class="msg-avatar">' + icon('sparkFilled', 16) + '</div>';
    const meta = '<div class="msg-meta"><span class="who">Cosmos</span><span class="when">' + esc(when) + '</span>' +
      (m.demo ? '<span class="demo-pill">رد تجريبي</span>' : '') +
      (m.mdl ? '<span class="when">' + esc(m.mdl) + '</span>' : '') + '</div>';
    let body;
    if (m.err) {
      body = '<div class="error-box">' + esc(m.c) + '</div>';
    } else if (m.pending && !m.c) {
      body = thinkingHTML(m.phase || 'جارٍ الاتصال…');
    } else {
      let rendered = '';
      try { rendered = md(m.c); } catch (e) { rendered = '<p>' + esc(m.c) + '</p>'; }
      body = '<div class="answer" id="ans-' + i + '" dir="auto">' + rendered + (m.pending ? '<span class="cursor-blink"></span>' : '') + '</div>';
    }
    const note = m.note ? '<div class="error-box" style="margin-top:9px">' + esc(m.note) + '</div>' : '';
    return '<div class="msg assistant-msg" data-msg="' + i + '">' + avatar + '<div class="msg-body">' + meta + body + note + msgActions(m, i) + '</div></div>';
  }

  function isNearBottom() {
    const sc = el('scroll');
    if (!sc) return true;
    return sc.scrollHeight - sc.scrollTop - sc.clientHeight < 180;
  }
  function scrollBottom() {
    const sc = el('scroll');
    if (!sc) return;
    sc.scrollTop = sc.scrollHeight;
    el('btnDown').classList.add('hidden');
  }

  function renderThread(options) {
    options = options || {};
    const thread = el('thread');
    if (!thread) return;
    const chat = activeChat();
    const near = isNearBottom();
    if (!chat || !chat.msgs || !chat.msgs.length) {
      thread.innerHTML = emptyHTML();
      paintIcons(thread);
      document.title = 'Cosmos — مساحة واحدة لكل أفكارك';
      el('btnDown').classList.add('hidden');
      return;
    }
    thread.innerHTML = chat.msgs.map(function (m, i) { return messageHTML(m, i, chat); }).join('') + '<div class="thread-end"></div>';
    document.title = truncate(chat.title || 'محادثة', 40) + ' — Cosmos';
    if (near || options.force) requestAnimationFrame(scrollBottom);
    el('btnDown').classList.toggle('hidden', isNearBottom());
  }

  function paintStream(chat, msg) {
    const i = chat.msgs.indexOf(msg);
    const ans = document.getElementById('ans-' + i);
    if (!ans) { renderThread(); return; }
    let rendered = '';
    try { rendered = md(msg.c); } catch (e) { rendered = '<p>' + esc(msg.c) + '</p>'; }
    ans.innerHTML = rendered + (msg.pending ? '<span class="cursor-blink"></span>' : '');
    if (isNearBottom()) scrollBottom();
  }

  /* ==========================================================================
     العرض: صندوق الكتابة والملحقات
     ========================================================================== */
  function resizeInput() {
    const input = el('input');
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(210, input.scrollHeight) + 'px';
  }

  function updateComposer() {
    const input = el('input');
    const send = el('btnSend');
    if (!send) return;
    const has = Boolean((input && input.value.trim()) || S.attachments.length);
    send.innerHTML = icon(S.busy ? 'stop' : 'arrowUp', 19);
    send.classList.toggle('stop', S.busy);
    send.setAttribute('aria-label', S.busy ? 'إيقاف التوليد' : 'إرسال');
    send.disabled = !S.busy && !has;
    send.classList.toggle('recording', S.recording && !S.busy);
    const mic = el('btnMic');
    if (mic) { mic.classList.toggle('active', S.recording); mic.disabled = S.busy; }
    const chip = el('modeChip');
    if (chip) {
      chip.classList.toggle('hidden', S.settings.mode !== 'code');
    }
    const codeOn = el('codeOn');
    if (codeOn) codeOn.classList.toggle('hidden', S.settings.mode !== 'code');
    const hint = el('composerHint');
    if (hint) {
      hint.textContent = S.offline ? 'تعذّر الاتصال بالخادم — ستُحفظ المحادثة محليًا فقط.' : (S.temp ? 'دردشة مؤقتة: لن تُحفظ ولن تظهر في المحادثات.' : 'قد يرتكب Cosmos أخطاء. تحقّق من المعلومات المهمة.');
      hint.classList.toggle('rec-hint', Boolean(S.offline));
    }
  }

  function renderAttachments() {
    const host = el('attachments');
    if (!host) return;
    host.classList.toggle('hidden', S.attachments.length === 0);
    host.innerHTML = S.attachments.map(function (f, i) {
      return '<div class="att-chip">' +
        (f.th ? '<img src="' + esc(f.th) + '" alt="">' : icon(f.kind === 'pdf' ? 'fileText' : 'fileText', 16)) +
        '<span title="' + esc(f.n) + '">' + esc(f.n) + '</span>' +
        '<button class="rm" type="button" data-rm-att="' + i + '" aria-label="إزالة">' + icon('x', 12) + '</button></div>';
    }).join('');
  }

  function updateModelChip() {
    const meta = modelMeta(S.settings.model);
    const name = el('modelName');
    if (name) name.textContent = modelShort(meta.id);
    const btn = el('modelBtn');
    if (btn) {
      btn.classList.toggle('fast', meta.tag === 'سريع');
      btn.title = (meta.label || '') + ' — ' + (meta.description || '');
    }
  }

  function renderModelMenu() {
    const menu = el('modelMenu');
    if (!menu) return;
    const models = S.models.length ? S.models : FALLBACK_MODELS;
    menu.innerHTML = '<div class="menu-label">اختر النموذج</div>' + models.map(function (m) {
      const selected = S.settings.model === m.id;
      return '<button class="menu-item" type="button" data-model="' + esc(m.id) + '" role="menuitem">' +
        icon(m.tag === 'سريع' ? 'bolt' : 'sparkles', 17) +
        '<span class="mi-body"><b>' + esc(m.label || m.id) + (m.tag ? '<span class="tag">' + esc(m.tag) + '</span>' : '') + '</b><span>' + esc(m.description || '') + '</span></span>' +
        (selected ? '<span class="check">' + icon('check', 16) + '</span>' : '') + '</button>';
    }).join('') +
      '<div class="menu-divider"></div><div class="menu-label">' + ((S.me && S.me.ai && S.me.ai.demo) ? 'وضع العرض المحلي — بدون اتصال بالنموذج' : 'مدعوم بواسطة Gemini') + '</div>';
    updateModelChip();
  }

  /* ==========================================================================
     الإعدادات والملف الشخصي وحالة الخادم
     ========================================================================== */
  function renderProfile() {
    const host = el('profileBox');
    if (!host) return;
    const user = S.me && S.me.user;
    if (user) {
      host.innerHTML = '<div class="settings-card"><div class="profile-line">' +
        '<span class="avatar">' + (user.picture ? '<img src="' + esc(user.picture) + '" alt="" referrerpolicy="no-referrer">' : esc(initials(user.name || user.email))) + '</span>' +
        '<span style="flex:1;min-width:0"><span class="nm">' + esc(user.name || 'مستخدم') + '</span><span class="em">' + esc(user.email || '') + '</span></span>' +
        '<span class="plan-badge ' + esc(user.plan || 'free') + '">' + esc(user.plan === 'premium' ? 'Premium' : user.plan === 'pro' ? 'Pro' : 'مجاني') + '</span>' +
        '</div></div>';
    } else {
      host.innerHTML = '<div class="settings-card"><div class="profile-line">' +
        '<span class="avatar">C</span><span style="flex:1"><span class="nm">أنت زائر الآن</span><span class="em">سجّل الدخول لمزامنة محادثاتك</span></span>' +
        '<button class="btn sm primary" data-account-open>دخول</button></div></div>';
    }
  }

  function renderSettingsToggles() {
    const map = [
      ['setTheme', S.settings.theme === 'dark'],
      ['setStream', Boolean(S.settings.stream)],
      ['setHistory', Boolean(S.settings.history)],
      ['setNotify', Boolean(S.settings.notify)],
    ];
    map.forEach(function (pair) {
      const node = el(pair[0]);
      if (!node) return;
      node.classList.toggle('on', pair[1]);
      node.setAttribute('aria-checked', String(pair[1]));
    });
  }

  function statusPill(status) {
    const labels = { ready: 'جاهز', demo: 'تجريبي', fallback: 'احتياطي', not_configured: 'غير مهيأ', missing_key: 'مفقود', optional: 'اختياري' };
    return '<span class="status-pill ' + esc(status || 'not_configured') + '">' + esc(labels[status] || status || '') + '</span>';
  }

  function renderStatusList() {
    const host = el('statusList');
    if (!host) return;
    const st = S.status;
    if (!st) {
      host.innerHTML = '<div class="ws-empty">' + icon('alert', 24) + 'لم تُجلب الحالة بعد</div>';
      return;
    }
    const rows = [];
    rows.push(['الخادم', 'ok', (st.app.name || 'Cosmos') + ' v' + (st.app.version || '')]);
    rows.push(['الذكاء الاصطناعي', st.ai && st.ai.demo ? 'warn' : st.ai && st.ai.keyConfigured ? 'ok' : 'bad', st.ai ? (st.ai.demo ? 'مزوّد محلي (mock)' : st.ai.model) : '—']);
    rows.push(['Google', st.features && st.features.googleLogin ? 'ok' : 'bad', st.features && st.features.googleLogin ? 'مهيأ' : 'غير مهيأ']);
    rows.push(['Stripe', st.features && st.features.stripe ? 'ok' : 'bad', st.features && st.features.stripe ? 'الدفع جاهز' : 'غير مهيأ']);
    rows.push(['البريد', st.features && st.features.emailLogin ? 'ok' : 'warn', st.features ? (st.features.emailDelivery === 'demo' ? 'وضع تجريبي' : st.features.emailDelivery === 'smtp' ? 'SMTP جاهز' : 'معطّل') : '—']);
    rows.push(['قاعدة البيانات', st.storage && st.storage.driver === 'postgres' ? 'ok' : 'warn', st.storage ? (st.storage.driver === 'postgres' ? 'PostgreSQL' : 'ملفات محلية') : '—']);
    rows.push(['Redis', st.redis && st.redis.available ? 'ok' : 'warn', st.redis && st.redis.available ? 'متصل' : 'ذاكرة محلية']);
    rows.push(['توليد الصور', st.features && st.features.images ? 'ok' : 'warn', st.ai && st.ai.imageModel ? 'مهيأ' : 'يحتاج إعدادًا']);
    rows.push(['الإشعارات', st.features && st.features.push ? 'ok' : 'warn', st.features && st.features.push ? 'مهيأة' : 'غير مهيأة']);
    rows.push(['حماية CLI', st.security && st.security.antiCli !== 'disabled' ? 'ok' : 'warn', st.security ? st.security.antiCli : '—']);
    host.innerHTML = rows.map(function (r) {
      return '<div class="status-row"><span class="status-dot ' + r[1] + '"></span><span>' + esc(r[0]) + '</span><b>' + esc(r[2]) + '</b></div>';
    }).join('');
    const info = el('appInfo');
    if (info) info.textContent = 'Cosmos v' + (st.app.version || '') + ' · ' + (st.app.env || '') + ' · ' + (st.storage ? (st.storage.driver === 'postgres' ? 'PostgreSQL' : 'تخزين ملفات محلي') : '');
    const adminLink = el('adminLink');
    if (adminLink) adminLink.hidden = !(st.features && st.features.diagnostics);
  }

  function renderIntegrations() {
    const host = el('integrationsList');
    if (!host) return;
    const integrations = (S.status && S.status.integrations) || (S.me && S.me.integrations) || [];
    if (!integrations.length) {
      host.innerHTML = '<div class="ws-empty">' + icon('puzzle', 26) + 'لا توجد بيانات عن التكاملات بعد.</div>';
      return;
    }
    host.innerHTML = (S.status && S.status.ai && S.status.ai.demo ? '<div class="alert warn">' + icon('activity', 14) + ' وضع العرض التجريبي مفعّل: لا يوجد اتصال حالي بنموذج Gemini. الردود توضيحية فقط حتى يتم وضع مفتاح صالح.</div>' : '') +
      integrations.map(function (it) {
        return '<div class="list-tile"><span class="ti-ico">' + icon(integrationIcon(it.id), 16) + '</span><span class="ti-body"><b>' + esc(it.name) + '</b><span>' + esc(it.detail || '') + (it.action ? ' — ' + esc(it.action) : '') + '</span></span>' + statusPill(it.status) + '</div>';
      }).join('');
  }
  function integrationIcon(id) {
    return { gemini: 'sparkles', google: 'google', email: 'mail', stripe: 'creditCard', database: 'database', redis: 'database', captcha: 'shield', push: 'activity', images: 'image', ads: 'globe' }[id] || 'puzzle';
  }

  function renderLog() {
    const host = el('logList');
    if (!host) return;
    if (!S.logs.length) {
      host.innerHTML = '<div class="ws-empty">' + icon('activity', 26) + 'لا طلبات بعد</div>';
      return;
    }
    host.innerHTML = S.logs.slice(0, 40).map(function (l) {
      return '<div class="log-item ' + (l.ok ? 'ok' : 'bad') + '"><div class="l1"><code>' + esc(l.path) + '</code><span class="st">' + esc(String(l.status)) + ' · ' + l.ms + 'ms</span></div><small>' + esc(l.t) + (l.note ? ' — ' + esc(truncate(l.note, 90)) : '') + '</small></div>';
    }).join('');
  }

  /* ==========================================================================
     إدارة المحادثات والحفظ والمزامنة
     ========================================================================== */
  function saveActive() {
    try {
      if (S.activeId) localStorage.setItem(LS.active, JSON.stringify(S.activeId));
      else localStorage.removeItem(LS.active);
    } catch (e) { /* ignore */ }
  }

  function createChat() {
    if (S.temp && S.tempChat) return S.tempChat;
    const chat = {
      id: uid(),
      title: 'محادثة جديدة',
      msgs: [],
      createdAt: now(),
      updatedAt: now(),
      starred: false,
      renamed: false,
    };
    if (S.temp) {
      chat.temp = true;
      S.tempChat = chat;
    } else {
      S.chats.unshift(chat);
      S.activeId = chat.id;
      saveActive();
    }
    return chat;
  }

  function newChat(options) {
    options = options || {};
    if (S.busy) stopGeneration();
    S.activeId = null;
    S.temp = Boolean(options.temp);
    S.tempChat = null;
    try { localStorage.removeItem(LS.active); } catch (e) { /* ignore */ }
    const input = el('input');
    if (input) input.value = '';
    S.attachments = [];
    resizeInput();
    renderAttachments();
    updateComposer();
    renderThread();
    renderChatList();
    renderTempButton();
    closeSidebar();
    setTimeout(focusInput, 60);
  }

  function renderTempButton() {
    const btn = el('btnTemp');
    if (!btn) return;
    btn.classList.toggle('active', S.temp);
    btn.title = S.temp ? 'إيقاف الدردشة المؤقتة' : 'دردشة مؤقتة — لا تُحفظ';
  }

  async function openChat(id) {
    const chat = S.chats.find(function (c) { return c.id === String(id); });
    if (!chat) return;
    if (S.busy) stopGeneration();
    S.temp = false;
    S.tempChat = null;
    S.activeId = chat.id;
    saveActive();
    renderChatList();
    renderTempButton();
    updateComposer();
    closeSidebar();
    if (!chat.msgs) {
      chat.msgs = [];
      chat.remote = true;
      renderThread();
      try {
        const data = await jsonApi('/api/chats/' + encodeURIComponent(chat.id));
        if (data && data.chat) {
          chat.msgs = Array.isArray(data.chat.msgs) ? data.chat.msgs : [];
          chat.title = data.chat.title || chat.title;
          chat.updatedAt = Date.parse(data.chat.updatedAt) || chat.updatedAt;
          chat.renamed = true;
        }
      } catch (e) {
        if (e.status !== 404) toast('تعذّر تحميل المحادثة: ' + e.message, 'err');
      }
      chat.remote = false;
      if (!S.chats.some(function (c) { return c.id === chat.id; })) return;
    }
    renderThread({ force: true });
    renderChatList();
    setTimeout(focusInput, 40);
  }

  async function deleteChat(id) {
    const chat = S.chats.find(function (c) { return c.id === String(id); });
    if (!chat) return;
    const ok = await confirmDialog({
      title: 'حذف المحادثة',
      message: 'سيتم حذف «' + truncate(chat.title, 60) + '» نهائيًا من هذا الجهاز ومن الخادم.',
      ok: 'حذف',
    });
    if (!ok) return;
    chat.deleted = true;
    S.chats = S.chats.filter(function (c) { return c.id !== chat.id; });
    if (S.activeId === chat.id) {
      S.activeId = null;
      saveActive();
      S.temp = false;
      renderThread();
    }
    saveChats();
    renderChatList();
    try { await jsonApi('/api/chats/' + encodeURIComponent(chat.id), { method: 'DELETE' }); } catch (e) { /* already gone */ }
    toast('تم حذف المحادثة');
  }

  async function renameChat(id) {
    const chat = S.chats.find(function (c) { return c.id === String(id); });
    if (!chat) return;
    const title = await askText({ title: 'إعادة تسمية المحادثة', label: 'اكتب عنوانًا واضحًا يسهل العثور عليه.', value: chat.title, maxlength: 100 });
    if (title === null || !title.trim()) return;
    chat.title = truncate(title.trim(), 100);
    chat.renamed = true;
    chat.updatedAt = now();
    saveChats();
    syncChat(chat);
    renderChatList();
    renderThread();
  }

  function starChat(id) {
    const chat = S.chats.find(function (c) { return c.id === String(id); });
    if (!chat) return;
    chat.starred = !chat.starred;
    saveChats();
    renderChatList();
    toast(chat.starred ? 'تم التثبيت في الأعلى' : 'تم إلغاء التثبيت');
  }

  function serializeChats(strip) {
    let budget = strip ? 0 : 2_600_000;
    const chats = sortedChats().slice(0, strip ? 30 : 80).map(function (c) {
      return {
        id: c.id,
        title: c.title,
        starred: Boolean(c.starred),
        renamed: Boolean(c.renamed),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        msgs: c.msgs === null ? null : (c.msgs || []).map(function (m) {
          const out = { r: m.r, c: m.c, at: m.at };
          if (m.err) out.err = 1;
          if (m.ms) out.ms = m.ms;
          if (m.mdl) out.mdl = m.mdl;
          if (m.demo) out.demo = 1;
          if (m.rating) out.rating = m.rating;
          if (m.note) out.note = m.note;
          if (m.f && m.f.length) {
            out.f = m.f.map(function (f) {
              const file = { n: f.n, kind: f.kind };
              if (!strip && f.th && f.th.length < 45_000) file.th = f.th;
              if (!strip && f.text) file.text = f.text.slice(0, 6000);
              if (!strip && f.img && budget > f.img.length) { file.img = f.img; budget -= f.img.length; }
              return file;
            });
          }
          return out;
        }),
      };
    });
    return JSON.stringify({ chats: chats, savedAt: now() });
  }

  function saveChats() {
    if (!S.chats.length) {
      try { localStorage.removeItem(LS.chats); } catch (e) { /* ignore */ }
      return;
    }
    try {
      localStorage.setItem(LS.chats, serializeChats(false));
    } catch (e) {
      try { localStorage.setItem(LS.chats, serializeChats(true)); }
      catch (e2) {
        try {
          const minimal = { chats: sortedChats().slice(0, 20).map(function (c) {
            return { id: c.id, title: c.title, starred: c.starred, renamed: c.renamed, createdAt: c.createdAt, updatedAt: c.updatedAt, msgs: (c.msgs || []).map(function (m) { return { r: m.r, c: truncate(m.c, 2000), at: m.at }; }) };
          }) };
          localStorage.setItem(LS.chats, JSON.stringify(minimal));
        } catch (e3) { /* ignore */ }
      }
    }
  }

  const syncTimers = new Map();
  const localOnlyWarned = new Set();
  function syncChat(chat) {
    if (!chat || chat.temp || chat.deleted || !S.me) return;
    const id = chat.id;
    clearTimeout(syncTimers.get(id));
    syncTimers.set(id, setTimeout(async function () {
      syncTimers.delete(id);
      if (!S.chats.some(function (c) { return c.id === id; })) return;
      const payload = {
        title: chat.title,
        model: S.settings.model,
        msgs: (chat.msgs || []).map(function (m) {
          return {
            r: m.r, c: m.c, err: m.err ? 1 : undefined, ms: m.ms, mdl: m.mdl,
            f: (m.f || []).map(function (f) { return { n: f.n, kind: f.kind, th: f.th }; }),
          };
        }),
      };
      try {
        await jsonApi('/api/chats/' + encodeURIComponent(id), { method: 'PUT', body: payload });
      } catch (err) {
        if (err.status === 413 && !localOnlyWarned.has(id)) {
          localOnlyWarned.add(id);
          toast('المحادثة كبيرة للحفظ على الخادم — ستبقى محفوظة في هذا المتصفح.', 'err', 4200);
        }
      }
    }, 850));
  }

  async function mergeServerChats() {
    try {
      const data = await jsonApi('/api/chats');
      let added = 0;
      (data.chats || []).forEach(function (s) {
        const id = String(s.id);
        const local = S.chats.find(function (c) { return c.id === id; });
        if (local) return;
        S.chats.push({
          id: id,
          title: s.title || 'محادثة',
          msgs: null,
          createdAt: Date.parse(s.createdAt) || now(),
          updatedAt: Date.parse(s.updatedAt) || now(),
          starred: false,
          renamed: true,
          remote: true,
        });
        added += 1;
      });
      if (added) renderChatList();
    } catch (e) { /* offline or no session */ }
  }

  function buildApiMessages(chat, upto) {
    let list = (chat.msgs || []).slice(0, upto);
    if (!S.settings.history) list = list.slice(-1);
    else list = list.slice(-40);
    const out = [];
    let textBudget = 600_000;
    const userTotal = list.filter(function (m) { return m.r === 'u'; }).length;
    let userWithFiles = 0;
    list.forEach(function (m) {
      if (m.err || typeof m.c !== 'string') return;
      if (m.r === 'a') {
        if (m.c) out.push({ role: 'assistant', content: m.c.slice(0, 40_000) });
        return;
      }
      let text = m.c || '';
      (m.f || []).forEach(function (f) {
        if (f.kind === 'text' && f.text) {
          const chunk = '\n\n--- ملف: ' + (f.n || 'ملف') + ' ---\n' + f.text + '\n--- نهاية الملف ---\n';
          if (textBudget > chunk.length) { text += chunk; textBudget -= chunk.length; }
        }
      });
      const parts = [];
      if (text || (m.f || []).length) parts.push({ type: 'text', text: text || 'حلّل المرفقات التالية.' });
      (m.f || []).forEach(function (f) {
        if (f.img) parts.push({ type: 'image_url', image_url: { url: f.img } });
        else if (f.kind === 'pdf' && f.data) parts.push({ type: 'file', file: { filename: f.n || 'file.pdf', mime_type: 'application/pdf', file_data: f.data } });
      });
      out.push({ role: 'user', content: parts.length > 1 ? parts : (text || '…') });
      if (m.f && m.f.length) userWithFiles += 1;
      if (m.f && m.f.length && userWithFiles < userTotal - 1) {
        // لا نعيد إرسال بيانات المرفقات الثقيلة إلا في آخر رسالتين تحملان مرفقات
        const last = out[out.length - 1];
        if (Array.isArray(last.content)) {
          last.content = last.content.filter(function (part) { return part.type === 'text'; });
          if (last.content.length === 1 && !last.content[0].text) last.content = text || '…';
          else last.content = last.content[0].text;
        }
      }
    });
    return out;
  }

  /* ==========================================================================
     الإرسال والبثّ
     ========================================================================== */
  function friendlyError(err) {
    if (!err) return 'حدث خطأ غير متوقع.';
    if (err.status === 429 && err.code === 'daily_limit') return err.message || 'بلغت الحد اليومي للرسائل.';
    if (err.status === 429) return err.message || 'طلبات كثيرة جدًا. انتظر قليلًا.';
    if (err.status === 401 || err.status === 403) return err.message || 'تحقّق من إعدادات الوصول.';
    if (err.status === 0) return 'تعذّر الاتصال بالخادم. تأكد أن الخادم يعمل ثم أعد المحاولة.';
    return err.message || 'تعذّر إكمال الطلب.';
  }

  async function chatFetch(body, signal) {
    const build = function () {
      return fetch('/v1/chat/completions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf(), 'X-Cosmos-Mode': S.settings.mode },
        body: JSON.stringify(body),
        signal: signal,
      });
    };
    const started = performance.now();
    let res = await build();
    if (res.status === 403) {
      const info = await res.clone().json().catch(function () { return null; });
      if (info && info.error && info.error.code === 'csrf') {
        await refreshMe();
        res = await build();
      }
    }
    logApi('/v1/chat/completions', res.status, Math.round(performance.now() - started), res.ok);
    return res;
  }

  async function streamAnswer(chat) {
    if (!chat || S.busy) return;
    const assistant = { r: 'a', c: '', pending: true, at: now(), phase: 'جارٍ الاتصال…' };
    chat.msgs.push(assistant);
    chat.updatedAt = now();
    S.busy = true;
    S.abort = new AbortController();
    updateComposer();
    renderThread({ force: true });
    const started = performance.now();
    let aborted = false;
    let demo = false;
    try {
      const body = {
        model: S.settings.model,
        messages: buildApiMessages(chat, chat.msgs.length - 1),
        stream: Boolean(S.settings.stream),
        mode: S.settings.mode,
      };
      const res = await chatFetch(body, S.abort.signal);
      if (!res.ok) {
        const info = await errorInfo(res);
        throw new AppError(info.message, res.status, info.code);
      }
      const ctype = res.headers.get('content-type') || '';
      if (S.settings.stream && ctype.indexOf('text/event-stream') >= 0 && res.body) {
        const result = await readSSE(res, assistant, chat);
        demo = Boolean(result.demo);
      } else {
        const data = await res.json();
        if (data && data.error) throw new AppError(data.error.message || 'خطأ من الخادم', 502, data.error.code);
        assistant.c = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) || '';
        assistant.demo = Boolean(data.demo);
        assistant.usage = data.usage || null;
        demo = assistant.demo;
        assistant.pending = true;
        paintStream(chat, assistant);
      }
      if (!assistant.c) {
        assistant.err = 1;
        assistant.c = 'لم يصل أي نص من النموذج. حاول مرة أخرى أو اختر نموذجًا آخر.';
      }
    } catch (err) {
      aborted = Boolean(S.abort && S.abort.signal.aborted) || err.name === 'AbortError';
      if (aborted) {
        if (!assistant.c) {
          chat.msgs = chat.msgs.filter(function (m) { return m !== assistant; });
        } else {
          assistant.note = 'تم إيقاف التوليد — قد يكون الرد غير مكتمل.';
        }
      } else if (assistant.c) {
        assistant.note = friendlyError(err);
      } else {
        assistant.err = 1;
        assistant.c = friendlyError(err);
      }
      if (err.status === 429 && err.code === 'daily_limit') {
        setTimeout(function () { S.me && S.me.user ? openUpgrade() : openAccount(); }, 500);
        toast('بلغت الحد اليومي للرسائل', 'err', 4200);
      }
    } finally {
      assistant.pending = false;
      assistant.phase = '';
      assistant.ms = Math.round(performance.now() - started);
      assistant.mdl = modelShort(S.settings.model);
      if (demo) assistant.demo = true;
      chat.updatedAt = now();
      S.busy = false;
      S.abort = null;
      updateComposer();
      renderThread();
      renderChatList();
      if (!chat.temp) {
        saveChats();
        syncChat(chat);
        refreshUsage();
      }
      if (demo) {
        showDemoBadge();
        if (!S.demoToastShown) {
          S.demoToastShown = true;
          toast('تعذّر الوصول إلى Gemini من الخادم — هذا رد توضيحي تجريبي.', 'err', 4200);
        }
      }
      if (aborted) toast('تم إيقاف التوليد');
    }
  }

  async function readSSE(res, assistant, chat) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let demo = false;
    let paintQueued = false;
    const schedule = function () {
      if (paintQueued) return;
      paintQueued = true;
      requestAnimationFrame(function () {
        paintQueued = false;
        paintStream(chat, assistant);
      });
    };
    const handle = function (raw) {
      if (!raw || raw === '[DONE]') return true;
      let data;
      try { data = JSON.parse(raw); } catch (e) { return false; }
      if (Array.isArray(data)) {
        data.forEach(handle);
        return false;
      }
      if (data.error) {
        throw new AppError(data.error.message || 'خطأ من النموذج', 502, data.error.code);
      }
      if (data.demo) demo = true;
      if (data.choices && data.choices[0]) {
        const delta = data.choices[0].delta || {};
        if (typeof delta.content === 'string' && delta.content) {
          assistant.c += delta.content;
          assistant.phase = '';
          schedule();
        }
      }
      if (data.usage) assistant.usage = data.usage;
      return false;
    };
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';
      for (const event of events) {
        const lines = event.split(/\r?\n/);
        const dataLines = lines.filter(function (line) { return line.indexOf('data:') === 0; }).map(function (line) { return line.slice(5).trim(); });
        if (!dataLines.length) continue;
        const raw = dataLines.join('\n');
        if (raw === '[DONE]') return { demo: demo };
        handle(raw);
      }
    }
    const tail = buffer.trim();
    if (tail.indexOf('data:') === 0) handle(tail.slice(5).trim());
    if (assistant.c && assistant.pending) paintStream(chat, assistant);
    return { demo: demo };
  }

  function stopGeneration() {
    if (!S.abort) return;
    try { S.abort.abort(); } catch (e) { /* ignore */ }
  }

  async function sendMessage(textOverride) {
    if (S.busy) { stopGeneration(); return; }
    const input = el('input');
    const text = String(textOverride !== undefined ? textOverride : input.value).trim();
    if (!text && !S.attachments.length) return;
    if (!S.me) {
      try { await refreshMe(); } catch (e) { toast('تعذّر الاتصال بالخادم. شغّل الخادم ثم أعد المحاولة.', 'err'); return; }
    }
    let chat = activeChat();
    if (!chat) chat = createChat();
    const files = S.attachments.map(function (f) { return Object.assign({}, f); });
    chat.msgs.push({ r: 'u', c: text, f: files.length ? files : undefined, at: now() });
    if (chat.msgs.length === 1 && !chat.renamed) chat.title = truncate(text || (files[0] && files[0].n) || 'محادثة جديدة', 52);
    chat.updatedAt = now();
    input.value = '';
    S.attachments = [];
    resizeInput();
    renderAttachments();
    updateComposer();
    renderThread({ force: true });
    renderChatList();
    if (!chat.temp) {
      saveChats();
      syncChat(chat);
    }
    await streamAnswer(chat);
  }

  async function regenerate(index) {
    if (S.busy) return;
    const chat = activeChat();
    if (!chat || !chat.msgs[index]) return;
    chat.msgs = chat.msgs.slice(0, index);
    chat.updatedAt = now();
    renderThread();
    if (!chat.temp) saveChats();
    await streamAnswer(chat);
  }

  function editMessage(index) {
    if (S.busy) return;
    const chat = activeChat();
    if (!chat || !chat.msgs[index] || chat.msgs[index].r !== 'u') return;
    const input = el('input');
    input.value = chat.msgs[index].c || '';
    S.attachments = [];
    renderAttachments();
    resizeInput();
    chat.msgs = chat.msgs.slice(0, index);
    chat.updatedAt = now();
    renderThread();
    renderChatList();
    if (!chat.temp) { saveChats(); syncChat(chat); }
    focusInput();
  }

  function focusInput() {
    const input = el('input');
    if (input) input.focus();
  }

  /* ==========================================================================
     المرفقات والملفات
     ========================================================================== */
  function fileLimit() { return (S.me && S.me.limits && S.me.limits.maxFileCount) || 5; }
  function fileSizeLimit() { return (S.me && S.me.limits && S.me.limits.maxFileSize) || 20 * 1024 * 1024; }

  function bufToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function (err) { URL.revokeObjectURL(url); reject(err); };
      img.src = url;
    });
  }

  function drawImage(img, max, quality) {
    const ratio = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * ratio));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height) * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  }

  async function processFile(file) {
    const limit = fileSizeLimit();
    if (file.size > limit) {
      toast('الملف «' + file.name + '» أكبر من الحد (' + Math.round(limit / 1024 / 1024) + 'MB)', 'err');
      return null;
    }
    if (/^image\//.test(file.type)) {
      try {
        const img = await loadImage(file);
        return {
          n: file.name || 'صورة',
          kind: 'image',
          mime: 'image/jpeg',
          img: drawImage(img, 1600, 0.86),
          th: drawImage(img, 360, 0.72),
          w: img.naturalWidth || img.width,
          h: img.naturalHeight || img.height,
        };
      } catch (e) {
        toast('تعذّرت قراءة الصورة «' + file.name + '»', 'err');
        return null;
      }
    }
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      if (file.size > 12 * 1024 * 1024) { toast('ملفات PDF محدودة بـ 12MB', 'err'); return null; }
      const buffer = await file.arrayBuffer();
      return { n: file.name, kind: 'pdf', mime: 'application/pdf', data: bufToBase64(buffer), size: file.size };
    }
    const isText = /^text\//.test(file.type) || /\.(txt|md|markdown|json|csv|js|mjs|cjs|ts|tsx|jsx|py|html?|css|ya?ml|xml|sql|sh|bash|log|ini|toml|rs|go|java|c|cc|cpp|h|hpp|env|example)$/i.test(file.name);
    if (isText) {
      if (file.size > 800 * 1024) { toast('الملف النصي كبير جدًا (الحد 800KB)', 'err'); return null; }
      try {
        const text = await file.text();
        return { n: file.name, kind: 'text', mime: file.type || 'text/plain', text: text.slice(0, 24_000), truncated: text.length > 24_000 };
      } catch (e) {
        toast('تعذّرت قراءة الملف «' + file.name + '»', 'err');
        return null;
      }
    }
    toast('نوع الملف غير مدعوم: ' + (file.type || file.name) + '. جرّب صورة أو PDF أو ملفًا نصيًا.', 'err');
    return null;
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (S.attachments.length + files.length > fileLimit()) {
      toast('الحد الأقصى ' + fileLimit() + ' ملفات في الرسالة.', 'err');
      return;
    }
    for (const file of files) {
      const processed = await processFile(file);
      if (!processed) continue;
      const currentBytes = S.attachments.reduce(function (n, f) {
        return n + (f.img ? f.img.length : 0) + (f.data ? f.data.length : 0) + (f.text ? f.text.length : 0);
      }, 0);
      const size = (processed.img ? processed.img.length : 0) + (processed.data ? processed.data.length : 0) + (processed.text ? processed.text.length : 0);
      if (currentBytes + size > 16_000_000) {
        toast('حجم المرفقات الإجمالي كبير جدًا. أزل بعض الملفات أو صغّر الصور.', 'err', 4200);
        continue;
      }
      S.attachments.push(processed);
    }
    renderAttachments();
    updateComposer();
  }

  function openLightbox(src) {
    const box = el('lightbox');
    el('lbImg').src = src;
    box.classList.add('open');
  }

  function speak(text, button) {
    if (!('speechSynthesis' in window)) { toast('النطق غير مدعوم في هذا المتصفح', 'err'); return; }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      $$('[data-act="speak"]').forEach(function (b) { b.classList.remove('on'); });
      return;
    }
    const utter = new SpeechSynthesisUtterance(String(text || '').slice(0, 3800));
    utter.lang = 'ar-SA';
    utter.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    const ar = voices.find(function (v) { return /^ar/i.test(v.lang); });
    if (ar) utter.voice = ar;
    utter.onend = function () { if (button) button.classList.remove('on'); };
    if (button) button.classList.add('on');
    window.speechSynthesis.speak(utter);
  }

  /* ==========================================================================
     لوحة العمل: الملاحظات والمكتبة والمهام
     ========================================================================== */
  function openWorkspace(tab) {
    const ws = el('workspace');
    if (!ws) return;
    ws.classList.remove('hidden');
    setWsTab(tab || S.settings.lastWsTab || 'notes');
    el('segWork').classList.add('active');
    el('segChat').classList.remove('active');
    el('wsOverlay').classList.toggle('show', window.innerWidth < 1180);
  }
  function closeWorkspace() {
    const ws = el('workspace');
    if (!ws) return;
    ws.classList.add('hidden');
    el('wsOverlay').classList.remove('show');
    el('segWork').classList.remove('active');
    el('segChat').classList.add('active');
  }
  function setWsTab(tab) {
    S.settings.lastWsTab = tab;
    $$('.ws-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.ws === tab); });
    $$('.ws-pane').forEach(function (p) { p.classList.toggle('active', p.id === 'ws-' + tab); });
    if (tab === 'notes') renderNotes();
    if (tab === 'library') renderLibrary();
    if (tab === 'tasks') renderTasks();
    if (tab === 'log') renderLog();
    if (tab === 'settings') {
      renderProfile();
      renderSettingsToggles();
      renderStatusList();
      if (!S.status) refreshStatus().catch(function () {});
      if (el('adminLink')) el('adminLink').hidden = !(S.me && S.me.features && S.me.features.diagnostics);
    }
  }

  /* --------------------------------- الملاحظات --------------------------------- */
  function saveNotes() { saveJSON(LS.notes, S.notes); }
  const saveNotesDebounced = debounce(saveNotes, 350);

  function renderNotes() {
    const host = el('notesList');
    if (!host) return;
    if (!S.notes.length) {
      host.innerHTML = '<div class="ws-empty">' + icon('book', 26) + 'لا ملاحظات بعد.<br>أضف أول فكرة تريد العودة إليها.</div>';
      return;
    }
    host.innerHTML = S.notes.map(function (n) {
      return '<div class="note-card" data-note-card="' + esc(n.id) + '">' +
        '<textarea data-note-text="' + esc(n.id) + '" placeholder="اكتب ملاحظتك…" aria-label="ملاحظة">' + esc(n.text || '') + '</textarea>' +
        '<div class="row"><span class="stamp">' + esc(relTime(n.createdAt)) + '</span>' +
        '<button class="icon-btn sm" data-note-send="' + esc(n.id) + '" title="أرسل إلى الدردشة">' + icon('send', 14) + '</button>' +
        '<button class="icon-btn sm" data-note-copy="' + esc(n.id) + '" title="نسخ">' + icon('copy', 14) + '</button>' +
        '<button class="icon-btn sm" data-note-del="' + esc(n.id) + '" title="حذف">' + icon('trash', 14) + '</button></div></div>';
    }).join('');
    paintIcons(host);
  }

  function addNote() {
    const note = { id: uid(), text: '', createdAt: now() };
    S.notes.unshift(note);
    saveNotes();
    renderNotes();
    setTimeout(function () {
      const ta = $('[data-note-text="' + note.id + '"]');
      if (ta) ta.focus();
      openWorkspace('notes');
    }, 40);
  }

  function noteText(id) {
    const n = S.notes.find(function (x) { return x.id === id; });
    return n ? n.text : '';
  }

  function sendNote(id) {
    const text = noteText(id).trim();
    if (!text) { toast('الملاحظة فارغة', 'err'); return; }
    if (S.busy) { toast('انتظر انتهاء الرد الحالي', 'err'); return; }
    if (window.innerWidth < 1180) closeWorkspace();
    el('input').value = text;
    resizeInput();
    updateComposer();
    sendMessage();
  }

  /* --------------------------------- المكتبة --------------------------------- */
  function saveLibrary() { saveJSON(LS.library, S.library); renderChatList(); }
  function renderLibrary() {
    const host = el('libraryList');
    if (!host) return;
    if (!S.library.length) {
      host.innerHTML = '<div class="ws-empty">' + icon('library', 26) + 'مكتبتك فارغة.<br>احفظ أمرًا أو ردًا مفيدًا لتجده بسرعة لاحقًا.</div>';
    } else {
      host.innerHTML = S.library.map(function (item) {
        return '<div class="lib-card"><div class="name">' + esc(item.title || 'بدون عنوان') + '</div><div class="txt">' + esc(item.text) + '</div>' +
          '<div class="row"><span class="stamp">' + esc(relTime(item.createdAt)) + '</span>' +
          '<button class="icon-btn sm" data-lib-use="' + esc(item.id) + '" title="استخدام">' + icon('send', 14) + '</button>' +
          '<button class="icon-btn sm" data-lib-copy="' + esc(item.id) + '" title="نسخ">' + icon('copy', 14) + '</button>' +
          '<button class="icon-btn sm" data-lib-del="' + esc(item.id) + '" title="حذف">' + icon('trash', 14) + '</button></div></div>';
      }).join('');
      paintIcons(host);
    }
    const count = el('libCount');
    if (count) count.textContent = S.library.length ? String(S.library.length) : '';
  }

  function addLibraryItem() {
    const titleInput = el('libTitle');
    const textInput = el('libInput');
    const text = textInput.value.trim();
    if (!text) { toast('اكتب نص الأمر أولًا', 'err'); textInput.focus(); return; }
    S.library.unshift({ id: uid(), title: titleInput.value.trim() || truncate(text, 42), text: text, createdAt: now() });
    titleInput.value = '';
    textInput.value = '';
    saveLibrary();
    renderLibrary();
    toast('تم الحفظ في المكتبة');
  }

  function useLibraryItem(id) {
    const item = S.library.find(function (x) { return x.id === id; });
    if (!item) return;
    const input = el('input');
    input.value = item.text;
    resizeInput();
    updateComposer();
    if (window.innerWidth < 1180) closeWorkspace();
    focusInput();
    toast('وضع الأمر في صندوق الكتابة');
  }

  /* --------------------------------- المهام --------------------------------- */
  function saveTasks() { saveJSON(LS.tasks, S.tasks); }
  function renderTasks() {
    const host = el('tasksList');
    if (!host) return;
    if (!S.tasks.length) {
      host.innerHTML = '<div class="ws-empty">' + icon('calendar', 26) + 'لا مهام مجدولة.<br>أضف تذكيرًا لموعد مهم.</div>';
      return;
    }
    const sorted = S.tasks.slice().sort(function (a, b) { return Number(a.due) - Number(b.due); });
    host.innerHTML = sorted.map(function (t) {
      const overdue = !t.done && Number(t.due) < now();
      return '<div class="task-card' + (t.done ? ' done' : '') + '">' +
        '<button class="tick" type="button" data-task-done="' + esc(t.id) + '" title="إكمال">' + icon(t.done ? 'check' : 'clock', 14) + '</button>' +
        '<div style="flex:1;min-width:0"><div class="txt">' + esc(t.text) + '</div><div class="due' + (overdue ? ' overdue' : '') + '">' + icon('calendar', 11) + esc(fmtDate(t.due)) + (overdue ? ' · متأخرة' : '') + '</div></div>' +
        '<button class="icon-btn sm" data-task-use="' + esc(t.id) + '" title="استخدم في الدردشة">' + icon('send', 13) + '</button>' +
        '<button class="icon-btn sm" data-task-del="' + esc(t.id) + '" title="حذف">' + icon('trash', 13) + '</button></div>';
    }).join('');
    paintIcons(host);
  }

  async function addTask() {
    const text = el('taskText').value.trim();
    const dueValue = el('taskDue').value;
    if (!text) { toast('اكتب نص المهمة', 'err'); el('taskText').focus(); return; }
    if (!dueValue) { toast('حدد موعد المهمة', 'err'); el('taskDue').focus(); return; }
    const due = new Date(dueValue).getTime();
    if (!Number.isFinite(due)) { toast('الموعد غير صالح', 'err'); return; }
    S.tasks.push({ id: uid(), text: text, due: due, done: false, notified: false, createdAt: now() });
    saveTasks();
    el('taskText').value = '';
    el('taskDue').value = '';
    renderTasks();
    toast('تمت إضافة المهمة');
    if (S.settings.notify && 'Notification' in window && Notification.permission === 'granted' && due > now()) {
      // إشعار فوري اختياري للتأكيد فقط عند الإضافة
    }
  }

  function toggleTask(id) {
    const task = S.tasks.find(function (t) { return t.id === id; });
    if (!task) return;
    task.done = !task.done;
    if (!task.done) task.notified = false;
    saveTasks();
    renderTasks();
  }

  function deleteTask(id) {
    S.tasks = S.tasks.filter(function (t) { return t.id !== id; });
    saveTasks();
    renderTasks();
  }

  function useTask(id) {
    const task = S.tasks.find(function (t) { return t.id === id; });
    if (!task) return;
    el('input').value = task.text;
    resizeInput();
    updateComposer();
    if (window.innerWidth < 1180) closeWorkspace();
    focusInput();
  }

  function requestNotifyPermission() {
    if (!('Notification' in window)) {
      toast('المتصفح لا يدعم الإشعارات', 'err');
      return Promise.resolve(false);
    }
    if (Notification.permission === 'granted') return Promise.resolve(true);
    if (Notification.permission === 'denied') { toast('الإشعارات مرفوضة من إعدادات المتصفح', 'err'); return Promise.resolve(false); }
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') toast('لم يتم منح إذن الإشعارات', 'err');
      return p === 'granted';
    });
  }

  function setNotifySetting(enabled) {
    if (!enabled) {
      S.settings.notify = false;
      saveSettings();
      renderSettingsToggles();
      toast('تم إيقاف إشعارات المهام');
      return;
    }
    requestNotifyPermission().then(function (ok) {
      S.settings.notify = ok;
      saveSettings();
      renderSettingsToggles();
      toast(ok ? 'تم تفعيل إشعارات المهام' : 'سيبقى التنبيه داخل الصفحة فقط', ok ? 'ok' : '');
    });
  }

  function notifyTask(task) {
    const body = task.text.length > 140 ? task.text.slice(0, 137) + '…' : task.text;
    if (S.settings.notify && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Cosmos — تذكير', { body: body, icon: '/icons/icon-192.png', tag: task.id }); } catch (e) { /* ignore */ }
    }
    toast('تذكير: ' + truncate(task.text, 90), 'ok', 6000);
    el('input').value = task.text;
    resizeInput();
    updateComposer();
  }

  function checkTasks() {
    let changed = false;
    S.tasks.forEach(function (task) {
      if (!task.done && !task.notified && Number(task.due) <= now()) {
        const lateBy = now() - Number(task.due);
        if (lateBy < 6 * 3600_000) notifyTask(task);
        task.notified = true;
        changed = true;
      }
    });
    if (changed) {
      saveTasks();
      if (el('ws-tasks') && el('ws-tasks').classList.contains('active')) renderTasks();
    }
  }

  /* ==========================================================================
     إدارة البيانات / الإعدادات
     ========================================================================== */
  async function exportAll() {
    const data = {
      exportedAt: new Date().toISOString(),
      app: 'Cosmos',
      settings: S.settings,
      chats: S.chats,
      notes: S.notes,
      library: S.library,
      tasks: S.tasks,
    };
    download('cosmos-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(data, null, 2));
    toast('تم تصدير بياناتك');
  }

  async function clearAllChats() {
    const ok = await confirmDialog({ title: 'حذف كل المحادثات', message: 'سيتم حذف كل المحادثات من هذا المتصفح ومن الخادم. لا يمكن التراجع.', ok: 'حذف الكل' });
    if (!ok) return;
    S.chats = [];
    S.activeId = null;
    S.temp = false;
    S.tempChat = null;
    saveChats();
    saveActive();
    renderChatList();
    renderThread();
    renderTempButton();
    try { await jsonApi('/api/chats?confirm=1', { method: 'DELETE' }); } catch (e) { /* offline */ }
    toast('تم حذف كل المحادثات');
  }

  async function logout() {
    const ok = await confirmDialog({ title: 'تسجيل الخروج', message: 'ستبقى محادثاتك المحفوظة على الخادم، وستُحذف نسختها المحلية من هذا الجهاز.', ok: 'خروج', danger: false });
    if (!ok) return;
    try { await jsonApi('/api/auth/logout', { method: 'POST', body: {} }); } catch (e) { /* ignore */ }
    S.chats = [];
    S.activeId = null;
    S.temp = false;
    S.tempChat = null;
    try { localStorage.removeItem(LS.chats); localStorage.removeItem(LS.active); } catch (e) { /* ignore */ }
    closeAllModals();
    renderChatList();
    renderThread();
    await refreshMe().catch(function () {});
    toast('تم تسجيل الخروج');
  }

  async function deleteAccount() {
    if (!S.me || !S.me.user) { toast('سجّل الدخول أولًا', 'err'); return; }
    const typed = await askText({
      title: 'حذف الحساب',
      label: 'سيُحذف حسابك وكل محادثاتك على الخادم نهائيًا. اكتب DELETE بالأحرف اللاتينية للتأكيد.',
      value: '',
      placeholder: 'DELETE',
      maxlength: 10,
    });
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== 'DELETE') { toast('لم يتم التأكيد — لم يُحذف الحساب', 'err'); return; }
    try {
      await jsonApi('/api/account/delete', { method: 'POST', body: { confirm: 'DELETE' } });
      S.chats = [];
      S.activeId = null;
      S.temp = false;
      localStorage.removeItem(LS.chats);
      localStorage.removeItem(LS.active);
      closeAllModals();
      renderChatList();
      renderThread();
      await refreshMe().catch(function () {});
      toast('تم حذف الحساب');
    } catch (e) {
      toast('تعذّر حذف الحساب: ' + e.message, 'err');
    }
  }

  /* ==========================================================================
     البحث
     ========================================================================== */
  function highlightText(text, query) {
    const source = String(text || '');
    if (!query) return esc(source);
    const idx = source.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return esc(source);
    return esc(source.slice(0, idx)) + '<mark>' + esc(source.slice(idx, idx + query.length)) + '</mark>' + esc(source.slice(idx + query.length));
  }

  function searchChats(query) {
    const q = String(query || '').trim().toLowerCase();
    const results = [];
    for (const chat of S.chats) {
      if (chat.temp) continue;
      let snippet = '';
      let matched = !q;
      if (q && (chat.title || '').toLowerCase().includes(q)) matched = true;
      if (q && Array.isArray(chat.msgs)) {
        for (const m of chat.msgs) {
          if (typeof m.c !== 'string') continue;
          const idx = m.c.toLowerCase().indexOf(q);
          if (idx >= 0) {
            matched = true;
            const start = Math.max(0, idx - 55);
            snippet = (start > 0 ? '…' : '') + m.c.slice(start, idx + q.length + 95).replace(/\s+/g, ' ');
            break;
          }
        }
      }
      if (!matched) continue;
      if (!snippet && Array.isArray(chat.msgs) && chat.msgs.length) {
        const last = chat.msgs[chat.msgs.length - 1];
        snippet = String(last.c || '').replace(/\s+/g, ' ').slice(0, 130);
      }
      results.push({ chat: chat, snippet: snippet });
    }
    return results.slice(0, 24);
  }

  function renderSearchResults(query) {
    const host = el('searchResults');
    if (!host) return;
    const q = String(query || '').trim();
    if (!S.chats.length) {
      host.innerHTML = '<div class="ws-empty">' + icon('search', 26) + 'لا توجد محادثات للبحث فيها بعد.</div>';
      return;
    }
    const results = searchChats(q);
    if (!results.length) {
      host.innerHTML = '<div class="ws-empty">' + icon('search', 26) + 'لا نتائج عن «' + esc(q) + '»</div>';
      return;
    }
    host.innerHTML = results.map(function (r) {
      return '<button class="search-result" type="button" data-open-chat="' + esc(r.chat.id) + '">' +
        '<span class="ti-ico" style="width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:var(--elevated);color:var(--muted)">' + icon('chat', 15) + '</span>' +
        '<span class="sr-body"><b>' + highlightText(r.chat.title, q) + '</b><span>' + highlightText(r.snippet || 'لا يوجد نص معاينة', q) + '</span></span></button>';
    }).join('');
    paintIcons(host);
  }

  function openSearch() {
    openModal('searchModal');
    const input = el('searchInput');
    input.value = '';
    renderSearchResults('');
    setTimeout(function () { input.focus(); }, 80);
  }

  /* ==========================================================================
     الحساب وتسجيل الدخول
     ========================================================================== */
  function planLabel(plan) {
    return plan === 'premium' ? 'Premium' : plan === 'pro' ? 'Pro' : 'مجاني';
  }

  function renderAccountBody() {
    const host = el('accountBody');
    if (!host) return;
    const user = S.me && S.me.user;
    if (user) {
      const usage = S.usage;
      const limit = usage && Number(usage.limit);
      const used = (usage && usage.used) || 0;
      host.innerHTML =
        '<div class="profile-line"><span class="avatar">' + (user.picture ? '<img src="' + esc(user.picture) + '" alt="" referrerpolicy="no-referrer">' : esc(initials(user.name || user.email))) + '</span>' +
        '<span style="flex:1;min-width:0"><span class="nm">' + esc(user.name || 'مستخدم') + '</span><span class="em">' + esc(user.email || '') + '</span></span>' +
        '<span class="plan-badge ' + esc(user.plan || 'free') + '">' + esc(planLabel(user.plan)) + '</span></div>' +
        '<div class="alert info">خطتك الحالية: <b>' + esc(planLabel(user.plan)) + '</b>' + (user.planStatus ? ' · الحالة: ' + esc(user.planStatus) : '') + '</div>' +
        '<div style="margin:12px 0 4px;font-size:11px;color:var(--muted)">الاستخدام اليومي</div>' +
        '<div class="usage-mini" style="padding:0"><span>' + num(used) + (limit ? ' / ' + num(limit) : ' · غير محدود') + '</span><span>يتجدد ' + esc(fmtDate(usage && usage.resetAt)) + '</span></div>' +
        '<div class="usage-bar" style="margin-bottom:16px"><i style="width:' + (limit ? clamp((used / limit) * 100, 0, 100) : 0) + '%"></i></div>' +
        '<div class="ws-actions">' +
        (user.plan === 'free' ? '<button class="btn primary" data-acc="upgrade">' + icon('sparkles', 14) + ' ترقية الخطة</button>' : '') +
        (user.stripeCustomerId ? '<button class="btn" data-acc="manage">' + icon('creditCard', 14) + ' إدارة الاشتراك</button>' : '') +
        '<button class="btn" data-acc="export">' + icon('download', 14) + ' تصدير بياناتي</button>' +
        '</div>' +
        '<div class="ws-actions" style="margin-top:10px">' +
        '<a class="btn" href="/api/account/export">' + icon('download', 14) + ' تنزيل نسخة كاملة</a>' +
        '<button class="btn danger" data-acc="logout">' + icon('logout', 14) + ' تسجيل الخروج</button>' +
        '</div>' +
        '<div class="hint-sm" style="margin-top:12px">حذف الحساب متاح من الإعدادات ← البيانات والخصوصية.</div>';
      return;
    }
    const delivery = S.me && S.me.features ? S.me.features.emailDelivery : 'smtp';
    host.innerHTML =
      '<div class="alert info">سجّل الدخول لمزامنة محادثاتك بين الأجهزة، والاحتفاظ بها بعد إغلاق المتصفح، وإدارة اشتراكك.</div>' +
      '<a class="auth-provider" href="/auth/google">' + icon('google', 18) + ' المتابعة عبر Google</a>' +
      '<div class="divider">أو بالبريد الإلكتروني</div>' +
      '<div id="emailStep1">' +
      '<div class="field"><label for="loginEmail">البريد الإلكتروني</label><input class="input" id="loginEmail" type="email" dir="ltr" placeholder="name@example.com" autocomplete="email"></div>' +
      '<button class="btn primary block" data-auth="send-code">' + icon('mail', 15) + ' أرسل رمز الدخول</button>' +
      '<p class="hint-sm">سنرسل رمزًا من 6 أرقام صالحًا لمدة 10 دقائق. ' + (delivery === 'demo' ? 'وضع التجربة مفعّل: سيظهر الرمز لك مباشرة.' : 'لا نستخدم كلمة مرور.') + '</p>' +
      '</div>' +
      '<div id="emailStep2" class="hidden">' +
      '<div class="alert ok" id="codeSentNote">أرسلنا رمزًا إلى <b id="loginEmailLabel" dir="ltr"></b></div>' +
      '<div class="field"><label for="loginCode">رمز الدخول</label><input class="input code-input" id="loginCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000"></div>' +
      '<button class="btn primary block" data-auth="verify">' + icon('check', 15) + ' دخول</button>' +
      '<div class="ws-actions" style="margin-top:9px"><button class="btn sm" data-auth="resend">' + icon('refresh', 13) + ' إعادة إرسال</button><button class="btn sm" data-auth="change-email">' + icon('edit', 13) + ' تغيير البريد</button></div>' +
      '</div>' +
      '<div id="authStatus" style="margin-top:12px"></div>';
  }

  function openAccount() {
    if (S.busy) { /* keep modal allowed */ }
    renderAccountBody();
    openModal('accountModal');
  }

  function setAuthStatus(kind, message, timeout) {
    const host = el('authStatus');
    if (!host) return;
    host.innerHTML = message ? '<div class="alert ' + kind + '">' + message + '</div>' : '';
    if (timeout) setTimeout(function () { if (host) host.innerHTML = ''; }, timeout);
  }

  async function sendLoginCode() {
    const email = (el('loginEmail') && el('loginEmail').value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setAuthStatus('bad', 'أدخل بريدًا إلكترونيًا صالحًا.'); return; }
    S.loginEmail = email;
    setAuthStatus('info', '<span class="spinner" style="display:inline-block;vertical-align:-2px"></span> جارٍ إرسال الرمز…');
    try {
      const data = await jsonApi('/api/auth/email/start', { method: 'POST', body: { email: email } });
      if (el('emailStep1')) el('emailStep1').classList.add('hidden');
      if (el('emailStep2')) el('emailStep2').classList.remove('hidden');
      if (el('loginEmailLabel')) el('loginEmailLabel').textContent = data.email || email;
      if (el('codeSentNote')) {
        el('codeSentNote').className = 'alert ' + (data.delivery === 'demo' ? 'warn' : 'ok');
        el('codeSentNote').innerHTML = data.delivery === 'demo'
          ? 'وضع التجربة: تعذّر إرسال البريد، والرمز ظاهر أدناه.'
          : 'أرسلنا رمزًا إلى <b id="loginEmailLabel" dir="ltr"></b>';
        if (data.delivery !== 'demo' && el('loginEmailLabel')) el('loginEmailLabel').textContent = data.email || email;
      }
      if (data.devCode) {
        if (el('loginCode')) el('loginCode').value = data.devCode;
        setAuthStatus('warn', 'وضع التجربة: الرمز هو <b dir="ltr">' + esc(data.devCode) + '</b> — تم تعبئته تلقائيًا. ' + (data.warning ? esc(data.warning) : ''));
      } else {
        setAuthStatus('ok', 'أُرسل الرمز. تحقّق من بريدك (والمجلد غير المرغوب فيه).');
      }
      if (el('loginCode')) el('loginCode').focus();
    } catch (e) {
      setAuthStatus('bad', esc(e.message) + (e.code === 'email_send_failed' ? '<br><small>يمكنك استخدام Google في الأعلى كبديل فوري.</small>' : ''));
    }
  }

  async function verifyLoginCode() {
    const code = (el('loginCode') && el('loginCode').value || '').replace(/\D/g, '');
    if (code.length !== 6) { setAuthStatus('bad', 'أدخل الرمز المكوّن من 6 أرقام.'); return; }
    setAuthStatus('info', '<span class="spinner" style="display:inline-block;vertical-align:-2px"></span> جارٍ التحقق…');
    try {
      await jsonApi('/api/auth/email/verify', { method: 'POST', body: { email: S.loginEmail, code: code } });
      closeModal('accountModal');
      await refreshMe();
      await mergeServerChats();
      renderChatList();
      renderThread();
      toast('تم تسجيل الدخول بنجاح', 'ok');
    } catch (e) {
      setAuthStatus('bad', esc(e.message));
    }
  }

  /* ==========================================================================
     الاشتراك
     ========================================================================== */
  function openUpgrade() {
    renderUpgradeBody();
    openModal('upgradeModal');
    if (!S.status) refreshStatus().then(renderUpgradeBody).catch(function () {});
  }

  function renderUpgradeBody() {
    const host = el('upgradeBody');
    if (!host) return;
    const plans = (S.me && S.me.plans) || (S.status && S.status.plans) || [];
    const current = S.me && S.me.user ? S.me.user.plan : 'guest';
    const stripeReady = Boolean((S.status && S.status.features && S.status.features.stripe) || (S.me && S.me.features && S.me.features.stripe));
    let html = '';
    if (!stripeReady) {
      html += '<div class="alert warn">Stripe غير مهيأ على الخادم. أضف <code>STRIPE_SECRET_KEY</code> وWebhook لتفعيل الاشتراكات، أو استخدم وضع العرض الحالي.</div>';
    }
    if (!plans.length) {
      html += '<div class="loading-line"><span class="spinner"></span> جارٍ تحميل الخطط…</div>';
      host.innerHTML = html;
      return;
    }
    html += '<div class="plan-grid">' + plans.map(function (plan, idx) {
      const featured = plan.id === 'premium';
      const isCurrent = current === plan.id;
      return '<div class="plan-card' + (featured ? ' featured' : '') + '">' +
        (featured ? '<span class="plan-tag">الأكثر اختيارًا</span>' : '') +
        '<h3>' + esc(plan.name) + '</h3><div class="plan-tagline">' + esc(plan.tagline || '') + '</div>' +
        '<div class="price">$' + Number(plan.price).toFixed(2) + '<small>/ شهر</small></div>' +
        '<ul>' + (plan.features || []).map(function (f) { return '<li>' + icon('check', 13) + ' ' + esc(f) + '</li>'; }).join('') + '</ul>' +
        '<button class="btn ' + (featured ? 'primary' : '') + ' block" data-buy="' + esc(plan.id) + '"' + (isCurrent ? ' disabled' : '') + '>' +
        (isCurrent ? 'خطتك الحالية' : (current !== 'guest' ? 'تبديل إلى ' : 'اشترك في ') + esc(plan.name)) + '</button>' +
        '</div>';
    }).join('') + '</div>';
    html += '<div class="free-plan-note">الأسعار بالدولار الأمريكي وتُحصَّل عبر Stripe. يمكنك الإلغاء في أي وقت من بوابة الفوترة.</div>';
    html += '<div id="upgradeStatus" style="margin-top:12px"></div>';
    host.innerHTML = html;
    paintIcons(host);
  }

  async function startCheckout(plan, button) {
    if (!S.me || !S.me.user) {
      closeModal('upgradeModal');
      openAccount();
      toast('سجّل الدخول أولًا ثم أكمل الاشتراك', 'err');
      return;
    }
    if (button) { button.disabled = true; button.innerHTML = '<span class="spinner"></span> جارٍ التحويل…'; }
    try {
      const data = await jsonApi('/api/billing/checkout', { method: 'POST', body: { plan: plan } });
      if (data.url) { window.location.href = data.url; return; }
      throw new AppError('لم يتم إنشاء جلسة دفع', 502, 'checkout');
    } catch (e) {
      const status = el('upgradeStatus');
      if (status) status.innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>';
      if (button) { button.disabled = false; button.textContent = 'إعادة المحاولة'; }
    }
  }

  async function openPortal() {
    try {
      const data = await jsonApi('/api/billing/portal', { method: 'POST', body: {} });
      if (data.url) window.location.href = data.url;
    } catch (e) {
      toast('تعذّر فتح بوابة الفوترة: ' + e.message, 'err');
    }
  }

  /* ==========================================================================
     استوديو الصور
     ========================================================================== */
  const IMAGE_IDEAS = [
    { label: 'غروب صحراوي', prompt: 'غروب فوق كثبان صحراوية، ظلال طويلة، سماء برتقالية وبنفسجية، أسلوب سينمائي' },
    { label: 'شعار تقني', prompt: 'شعار دائري بسيط لشركة ذكاء اصطناعي عربية، خطوط هندسية، خلفية شفافة، ألوان بنفسجية' },
    { label: 'مدينة المستقبل', prompt: 'مدينة خليجية مستقبلية عند الليل، أبراج زجاجية، ضباب خفيف، انعكاسات على الماء' },
    { label: 'قطة لطيفة', prompt: 'صورة قريبة لقطة برتقالية لطيفة بعيون خضراء، إضاءة ناعمة، خلفية بوكيه دافئة' },
  ];
  function openImages() {
    const ideas = el('imageIdeas');
    if (ideas) {
      ideas.innerHTML = IMAGE_IDEAS.map(function (i) { return '<button class="btn sm" type="button" data-image-idea="' + esc(i.prompt) + '">' + esc(i.label) + '</button>'; }).join('');
    }
    el('imageResult').innerHTML = '';
    openModal('imagesModal');
  }

  async function generateImage() {
    const prompt = el('imagePrompt').value.trim();
    if (prompt.length < 3) { toast('اكتب وصفًا أوضح للصورة', 'err'); el('imagePrompt').focus(); return; }
    const button = el('btnGenerateImage');
    const result = el('imageResult');
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> جارٍ توليد الصورة…';
    result.innerHTML = '';
    try {
      const data = await jsonApi('/api/images', { method: 'POST', body: { prompt: prompt } });
      const ext = String(data.image || '').startsWith('data:image/svg') ? 'svg' : 'png';
      result.innerHTML = '<div class="image-frame"><img src="' + esc(data.image) + '" alt="' + esc(prompt) + '">' +
        '<div class="image-meta"><span>' + esc(data.model || 'Cosmos') + (data.demo ? ' · وضع تجريبي' : '') + '</span>' +
        '<a class="btn sm" download="cosmos-image.' + ext + '" href="' + esc(data.image) + '">' + icon('download', 13) + ' تنزيل</a></div></div>' +
        (data.demo ? '<div class="alert warn" style="margin-top:10px">' + esc(data.text || 'تعذّر الوصول إلى نموذج الصور، فعُرضت صورة توضيحية محلية.') + '</div>' : '');
    } catch (e) {
      result.innerHTML = '<div class="alert bad" style="margin-top:12px">' + esc(e.message) +
        (e.code === 'image_not_configured' ? '<br><small>أضف النموذج في <code>.env</code> ثم أعد تشغيل الخادم.</small>' : '') + '</div>';
    } finally {
      button.disabled = false;
      button.innerHTML = icon('wand', 15) + ' أنشئ الصورة';
    }
  }

  /* ==========================================================================
     الاستكشاف والتكاملات والملاحظات
     ========================================================================== */
  const EXPLORE = [
    { icon: 'edit', title: 'تحسين نص عربي', text: 'اجعل الفقرة أكثر وضوحًا وإقناعًا', prompt: 'حسّن النص التالي ليصبح أكثر وضوحًا وإقناعًا مع الحفاظ على المعنى، ثم اشرح أهم التغييرات:\n\n' },
    { icon: 'code', title: 'مراجعة كود', text: 'اكتشف الأخطاء واقترح تحسينات', prompt: 'راجع الكود التالي واذكر الأخطاء المحتملة، والأداء، وقابلية القراءة، ثم أقترح نسخة محسّنة:\n\n' },
    { icon: 'book', title: 'خطة تعلّم', text: 'مسار عملي في 30 يومًا', prompt: 'صمّم لي خطة تعلّم عملية لمدة 30 يومًا في ' },
    { icon: 'globe', title: 'ترجمة احترافية', text: 'ترجم مع الحفاظ على النبرة', prompt: 'ترجم النص التالي إلى الإنجليزية بأسلوب احترافي مع الحفاظ على النبرة، واذكر أي تعبيرات تحتاج تكييفًا ثقافيًا:\n\n' },
    { icon: 'creditCard', title: 'عرض تجاري', text: 'قدّم فكرة منتج في دقيقة', prompt: 'اكتب عرضًا تجاريًا مختصرًا (60 ثانية) لفكرة منتج، يشمل المشكلة والحل والقيمة والمقابل.' },
    { icon: 'image', title: 'وصف صورة', text: 'حوّل صورة إلى قصة', prompt: 'أرفق صورة وسأصفها لك وكأنها مشهد من قصة، ثم أقترح عنوانًا لها.', attach: true },
    { icon: 'activity', title: 'تحليل بيانات', text: 'اكتشف الأنماط في أرقامك', prompt: 'سأعطيك بيانات، حلّلها واكتشف الأنماط والاتجاهات، ثم اقترح قرارات عملية بناءً عليها.' },
    { icon: 'chat', title: 'محاكاة مقابلة', text: 'تدرب على مقابلة عمل', prompt: 'أجرِ معي مقابلة عمل لوظيفة ' },
  ];

  function openExplore() {
    const host = el('exploreGrid');
    if (host) {
      host.innerHTML = EXPLORE.map(function (item) {
        return '<button class="prompt-card" type="button" ' + (item.attach ? 'data-act="attach"' : 'data-prompt="' + esc(item.prompt) + '"') + '>' +
          '<span class="pc-ico">' + icon(item.icon, 15) + '</span><b>' + esc(item.title) + '</b><span>' + esc(item.text) + '</span></button>';
      }).join('');
    }
    openModal('exploreModal');
  }

  function openIntegrations() {
    renderIntegrations();
    openModal('integrationsModal');
    if (!S.status) refreshStatus().then(renderIntegrations).catch(function () {});
  }

  function openFeedback() {
    el('fbStatus').innerHTML = '';
    openModal('feedbackModal');
  }

  async function sendFeedback() {
    const message = el('fbMessage').value.trim();
    if (message.length < 3) { el('fbStatus').innerHTML = '<div class="alert bad">اكتب ملاحظتك أولًا.</div>'; return; }
    const button = el('btnSendFeedback');
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> جارٍ الإرسال…';
    try {
      const data = await jsonApi('/api/feedback', {
        method: 'POST',
        body: { message: message, email: el('fbEmail').value.trim(), name: el('fbName').value.trim() },
      });
      el('fbStatus').innerHTML = '<div class="alert ok">' + esc(data.note || 'شكرًا لك! وصلت ملاحظتك.') + '</div>';
      el('fbMessage').value = '';
      setTimeout(function () { closeModal('feedbackModal'); }, 1400);
    } catch (e) {
      el('fbStatus').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>';
    } finally {
      button.disabled = false;
      button.innerHTML = icon('send', 15) + ' إرسال الملاحظة';
    }
  }

  /* ==========================================================================
     ربط الأحداث
     ========================================================================== */
  function toggleSidebar(forceOpen) {
    const sidebar = el('sidebar');
    if (!sidebar) return;
    const mobile = window.innerWidth <= 900;
    if (mobile) {
      const willOpen = forceOpen === undefined ? sidebar.classList.contains('collapsed') : forceOpen;
      sidebar.classList.toggle('collapsed', !willOpen);
      el('overlay').classList.toggle('show', willOpen);
    } else {
      sidebar.classList.toggle('collapsed');
    }
  }
  function closeSidebar() {
    if (window.innerWidth <= 900) {
      el('sidebar').classList.add('collapsed');
      el('overlay').classList.remove('show');
    }
  }
  function toggleModelMenu(force) {
    const menu = el('modelMenu');
    const button = el('modelBtn');
    if (!menu) return;
    const show = force === undefined ? menu.classList.contains('hidden') : force;
    menu.classList.toggle('hidden', !show);
    if (button) button.setAttribute('aria-expanded', String(show));
  }
  function fillPrompt(prompt) {
    closeAllModals();
    el('input').value = prompt;
    resizeInput();
    updateComposer();
    if (window.innerWidth < 1180) closeWorkspace();
    closeSidebar();
    focusInput();
    toast('عدّل الأمر أو أرسله مباشرة', '', 1800);
  }
  function handleOpenAction(action) {
    closeSidebar();
    if (action === 'images') openImages();
    else if (action === 'tasks') openWorkspace('tasks');
    else if (action === 'library') openWorkspace('library');
    else if (action === 'integrations') openIntegrations();
    else if (action === 'explore') openExplore();
    else if (action === 'settings') openWorkspace('settings');
    else if (action === 'code') {
      S.settings.mode = S.settings.mode === 'code' ? 'chat' : 'code';
      saveSettings();
      updateComposer();
      toast(S.settings.mode === 'code' ? 'وضع الكود مفعّل — سيركّز الرد على الحلول البرمجية' : 'تم إيقاف وضع الكود');
    }
  }

  function localDateTimeValue(date) {
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function bindEvents() {
    /* الشريط الجانبي */
    el('btnNew').addEventListener('click', function () { newChat(); });
    el('btnSearchSide').addEventListener('click', openSearch);
    el('btnCollapse').addEventListener('click', function () { toggleSidebar(); });
    el('btnSidebarMobile').addEventListener('click', function () { toggleSidebar(true); });
    el('btnSidebarDesk').addEventListener('click', function () { toggleSidebar(); });
    el('overlay').addEventListener('click', closeSidebar);
    el('accountBtn').addEventListener('click', openAccount);
    el('btnUpgrade').addEventListener('click', openUpgrade);
    el('btnUpgradeTop').addEventListener('click', openUpgrade);
    el('btnFeedback').addEventListener('click', openFeedback);
    el('btnTemp').addEventListener('click', function () {
      if (!S.temp) {
        newChat({ temp: true });
        toast('دردشة مؤقتة: لن تُحفظ في السجل أو على الخادم');
      } else {
        newChat({});
        toast('تم إيقاف الدردشة المؤقتة');
      }
    });

    el('sidebar').addEventListener('click', function (e) {
      const nav = e.target.closest('[data-open]');
      if (nav) { e.preventDefault(); handleOpenAction(nav.dataset.open); return; }
      const open = e.target.closest('[data-open-chat]');
      if (open) { e.preventDefault(); openChat(open.dataset.openChat); return; }
      const temp = e.target.closest('[data-temp-chat]');
      if (temp) { e.preventDefault(); closeSidebar(); renderThread(); focusInput(); return; }
      const star = e.target.closest('[data-star]');
      if (star) { starChat(star.dataset.star); return; }
      const rename = e.target.closest('[data-rename]');
      if (rename) { renameChat(rename.dataset.rename); return; }
      const del = e.target.closest('[data-del]');
      if (del) { deleteChat(del.dataset.del); }
    });

    /* الترويسة */
    el('segChat').addEventListener('click', closeWorkspace);
    el('segWork').addEventListener('click', function () { openWorkspace(S.settings.lastWsTab || 'notes'); });
    el('btnWsClose').addEventListener('click', closeWorkspace);
    el('wsOverlay').addEventListener('click', closeWorkspace);
    $$('.ws-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { setWsTab(tab.dataset.ws); });
    });

    /* صندوق الكتابة */
    const input = el('input');
    input.addEventListener('input', function () { resizeInput(); updateComposer(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 760) {
        e.preventDefault();
        sendMessage();
      }
    });
    el('btnSend').addEventListener('click', function () { S.busy ? stopGeneration() : sendMessage(); });
    el('btnAttach').addEventListener('click', function () { el('fileInput').click(); });
    el('fileInput').addEventListener('change', function (e) {
      addFiles(e.target.files);
      e.target.value = '';
    });
    el('attachments').addEventListener('click', function (e) {
      const rm = e.target.closest('[data-rm-att]');
      if (!rm) return;
      S.attachments.splice(Number(rm.dataset.rmAtt), 1);
      renderAttachments();
      updateComposer();
    });
    el('modelBtn').addEventListener('click', function (e) { e.stopPropagation(); toggleModelMenu(); });
    el('modelMenu').addEventListener('click', function (e) {
      const item = e.target.closest('[data-model]');
      if (!item) return;
      S.settings.model = item.dataset.model;
      saveSettings();
      updateModelChip();
      renderModelMenu();
      toggleModelMenu(false);
      toast('النموذج: ' + modelShort(S.settings.model));
    });
    el('btnMic').addEventListener('click', toggleMic);
    el('modeChip').addEventListener('click', function () {
      S.settings.mode = 'chat';
      saveSettings();
      updateComposer();
      toast('تم إيقاف وضع الكود');
    });

    /* المحادثة */
    el('scroll').addEventListener('scroll', function () {
      el('btnDown').classList.toggle('hidden', isNearBottom());
    });
    el('btnDown').addEventListener('click', scrollBottom);
    el('thread').addEventListener('click', function (e) {
      const codeCopy = e.target.closest('[data-codecopy]');
      if (codeCopy) {
        const pre = codeCopy.closest('.code-block').querySelector('pre');
        copyText(pre ? pre.innerText : '');
        codeCopy.innerHTML = icon('check', 12) + ' تم';
        setTimeout(function () { codeCopy.innerHTML = icon('copy', 12) + ' نسخ'; }, 1500);
        return;
      }
      const zoom = e.target.closest('[data-zoom]');
      if (zoom) { openLightbox(zoom.dataset.zoom); return; }
      const action = e.target.closest('[data-act]');
      if (!action) return;
      const chat = activeChat();
      if (!chat) return;
      const index = Number(action.dataset.i);
      const msg = chat.msgs[index];
      const act = action.dataset.act;
      if (act === 'copy') {
        if (msg) copyText(msg.c || '');
      } else if (act === 'editmsg') {
        editMessage(index);
      } else if (act === 'regen') {
        regenerate(index);
      } else if (act === 'like' || act === 'dislike') {
        if (!msg) return;
        const rating = act === 'like' ? 'up' : 'down';
        msg.rating = msg.rating === rating ? null : rating;
        saveChats();
        renderThread();
        if (msg.rating) toast('شكرًا على ملاحظتك');
      } else if (act === 'speak') {
        if (msg) speak(msg.c || '', action);
      } else if (act === 'save') {
        if (!msg) return;
        S.library.unshift({ id: uid(), title: truncate(msg.c || 'رد محفوظ', 42), text: msg.c || '', createdAt: now() });
        saveLibrary();
        renderLibrary();
        toast('تم الحفظ في المكتبة');
      }
    });

    /* النقر العام: أوامر جاهزة وإرفاق */
    document.addEventListener('click', function (e) {
      const prompt = e.target.closest('[data-prompt]');
      if (prompt) { fillPrompt(prompt.dataset.prompt); return; }
      const attach = e.target.closest('[data-act="attach"]');
      if (attach) { closeAllModals(); el('fileInput').click(); return; }
      const accountOpen = e.target.closest('[data-account-open]');
      if (accountOpen) { openAccount(); return; }
      if (!e.target.closest('.model-wrap')) toggleModelMenu(false);
    });

    /* النوافذ */
    const closeMap = {
      accountClose: 'accountModal', upgradeClose: 'upgradeModal', imageClose: 'imagesModal',
      integrationsClose: 'integrationsModal', exploreClose: 'exploreModal', feedbackClose: 'feedbackModal',
      confirmClose: 'confirmModal', askClose: 'askModal', btnSearchClose: 'searchModal', accountClose2: 'accountModal',
    };
    Object.keys(closeMap).forEach(function (id) {
      const node = el(id);
      if (node) node.addEventListener('click', function () {
        if (closeMap[id] === 'confirmModal') finishConfirm(false);
        else if (closeMap[id] === 'askModal') finishAsk(null);
        else closeModal(closeMap[id]);
      });
    });
    $$('.modal').forEach(function (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target !== modal) return;
        if (modal.id === 'confirmModal') finishConfirm(false);
        else if (modal.id === 'askModal') finishAsk(null);
        else closeModal(modal.id);
      });
    });
    el('confirmOk').addEventListener('click', function () { finishConfirm(true); });
    el('confirmCancel').addEventListener('click', function () { finishConfirm(false); });
    el('askOk').addEventListener('click', function () { finishAsk(el('askInput').value); });
    el('askCancel').addEventListener('click', function () { finishAsk(null); });
    el('askInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finishAsk(el('askInput').value); }
    });

    /* البحث */
    el('searchInput').addEventListener('input', function (e) { renderSearchResults(e.target.value); });
    el('searchInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        const first = el('searchResults').querySelector('[data-open-chat]');
        if (first) { closeModal('searchModal'); openChat(first.dataset.openChat); }
      }
    });
    el('searchResults').addEventListener('click', function (e) {
      const item = e.target.closest('[data-open-chat]');
      if (item) { closeModal('searchModal'); openChat(item.dataset.openChat); }
    });

    /* الحساب */
    el('accountBody').addEventListener('click', function (e) {
      const acc = e.target.closest('[data-acc]');
      if (acc) {
        const what = acc.dataset.acc;
        if (what === 'logout') logout();
        else if (what === 'export') exportAll();
        else if (what === 'manage') openPortal();
        else if (what === 'upgrade') { closeModal('accountModal'); openUpgrade(); }
        return;
      }
      const auth = e.target.closest('[data-auth]');
      if (auth) {
        const what = auth.dataset.auth;
        if (what === 'send-code' || what === 'resend') sendLoginCode();
        else if (what === 'verify') verifyLoginCode();
        else if (what === 'change-email') {
          el('emailStep1').classList.remove('hidden');
          el('emailStep2').classList.add('hidden');
          setAuthStatus('', '');
          if (el('loginEmail')) el('loginEmail').focus();
        }
      }
    });
    el('accountBody').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.target.id === 'loginEmail') { e.preventDefault(); sendLoginCode(); }
      else if (e.target.id === 'loginCode') { e.preventDefault(); verifyLoginCode(); }
    });

    /* الاشتراك */
    el('upgradeBody').addEventListener('click', function (e) {
      const buy = e.target.closest('[data-buy]');
      if (buy) startCheckout(buy.dataset.buy, buy);
    });

    /* الصور */
    el('btnGenerateImage').addEventListener('click', generateImage);
    el('imageIdeas').addEventListener('click', function (e) {
      const idea = e.target.closest('[data-image-idea]');
      if (!idea) return;
      el('imagePrompt').value = idea.dataset.imageIdea;
      el('imagePrompt').focus();
    });

    /* التكاملات */
    el('btnRefreshIntegrations').addEventListener('click', async function () {
      const btn = this;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> تحديث';
      try { await refreshStatus(); renderIntegrations(); toast('تم تحديث الحالة', 'ok'); }
      catch (e) { toast('تعذّر تحديث الحالة', 'err'); }
      finally { btn.disabled = false; btn.innerHTML = icon('refresh', 13) + ' تحديث'; }
    });

    /* الملاحظات */
    el('btnNewNote').addEventListener('click', addNote);
    el('notesList').addEventListener('input', function (e) {
      const ta = e.target.closest('[data-note-text]');
      if (!ta) return;
      const note = S.notes.find(function (n) { return n.id === ta.dataset.noteText; });
      if (note) { note.text = ta.value; saveNotesDebounced(); }
    });
    el('notesList').addEventListener('click', function (e) {
      const send = e.target.closest('[data-note-send]');
      if (send) { sendNote(send.dataset.noteSend); return; }
      const copy = e.target.closest('[data-note-copy]');
      if (copy) { copyText(noteText(copy.dataset.noteCopy)); return; }
      const del = e.target.closest('[data-note-del]');
      if (del) {
        S.notes = S.notes.filter(function (n) { return n.id !== del.dataset.noteDel; });
        saveNotes(); renderNotes(); toast('حُذفت الملاحظة');
      }
    });

    /* المكتبة */
    el('btnAddLib').addEventListener('click', addLibraryItem);
    el('libraryList').addEventListener('click', function (e) {
      const use = e.target.closest('[data-lib-use]');
      if (use) { useLibraryItem(use.dataset.libUse); return; }
      const copy = e.target.closest('[data-lib-copy]');
      if (copy) {
        const item = S.library.find(function (x) { return x.id === copy.dataset.libCopy; });
        if (item) copyText(item.text);
        return;
      }
      const del = e.target.closest('[data-lib-del]');
      if (del) {
        S.library = S.library.filter(function (x) { return x.id !== del.dataset.libDel; });
        saveLibrary(); renderLibrary(); toast('حُذف العنصر');
      }
    });

    /* المهام */
    el('btnAddTask').addEventListener('click', addTask);
    el('tasksList').addEventListener('click', function (e) {
      const done = e.target.closest('[data-task-done]');
      if (done) { toggleTask(done.dataset.taskDone); return; }
      const del = e.target.closest('[data-task-del]');
      if (del) { deleteTask(del.dataset.taskDel); return; }
      const use = e.target.closest('[data-task-use]');
      if (use) useTask(use.dataset.taskUse);
    });

    /* السجل والإعدادات */
    el('btnClearLog').addEventListener('click', function () { S.logs = []; renderLog(); toast('تم مسح السجل'); });
    el('btnRefreshStatus').addEventListener('click', async function () {
      const btn = this;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> جارٍ الفحص…';
      try { await refreshStatus(); renderStatusList(); toast('الخادم متصل', 'ok'); }
      catch (e) { toast('تعذّر الاتصال بالخادم: ' + e.message, 'err', 4200); }
      finally { btn.disabled = false; btn.innerHTML = icon('refresh', 14) + ' تحديث الحالة'; }
    });
    el('setTheme').addEventListener('click', toggleTheme);
    el('setStream').addEventListener('click', function () {
      S.settings.stream = !S.settings.stream;
      saveSettings(); renderSettingsToggles();
      toast(S.settings.stream ? 'البث المباشر مفعّل' : 'سيُعرض الرد كاملًا بعد اكتماله');
    });
    el('setHistory').addEventListener('click', function () {
      S.settings.history = !S.settings.history;
      saveSettings(); renderSettingsToggles();
      toast(S.settings.history ? 'سياق المحادثة مفعّل' : 'سيُرسل آخر سؤال فقط');
    });
    el('setNotify').addEventListener('click', function () { setNotifySetting(!S.settings.notify); });
    el('btnExportLocal').addEventListener('click', exportAll);
    el('btnClearChats').addEventListener('click', clearAllChats);
    el('btnOpenAccount').addEventListener('click', openAccount);
    el('btnDeleteAccount').addEventListener('click', deleteAccount);
    el('btnFeedback2').addEventListener('click', openFeedback);
    el('btnSendFeedback').addEventListener('click', sendFeedback);

    /* الميكروفون والصور والنقر خارج القوائم */
    el('lightbox').addEventListener('click', function () { this.classList.remove('open'); });
    el('searchInput').addEventListener('focus', function () { renderSearchResults(this.value); });

    /* السحب والإفلات واللصق */
    let dragDepth = 0;
    window.addEventListener('dragenter', function (e) {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
      dragDepth += 1;
      el('dropzone').classList.add('show');
    });
    window.addEventListener('dragleave', function (e) {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) el('dropzone').classList.remove('show');
    });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) {
      e.preventDefault();
      dragDepth = 0;
      el('dropzone').classList.remove('show');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    });
    document.addEventListener('paste', function (e) {
      if (!e.clipboardData || !e.clipboardData.files || !e.clipboardData.files.length) return;
      if (e.target && e.target.closest && e.target.closest('input, textarea') && !e.target.closest('#input')) return;
      e.preventDefault();
      addFiles(e.clipboardData.files);
    });

    /* اختصارات لوحة المفاتيح */
    document.addEventListener('keydown', function (e) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); return; }
      if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); newChat(); return; }
      if (e.key === 'Escape') {
        if (anyModalOpen()) {
          if (el('confirmModal').classList.contains('open')) { finishConfirm(false); return; }
          if (el('askModal').classList.contains('open')) { finishAsk(null); return; }
          closeAllModals(); return;
        }
        if (!el('workspace').classList.contains('hidden') && window.innerWidth < 1180) { closeWorkspace(); return; }
        closeSidebar();
      }
    });

    /* الشبكة */
    window.addEventListener('online', function () {
      S.offline = false;
      toast('عاد الاتصال — جارٍ المزامنة', 'ok');
      refreshMe().then(mergeServerChats).catch(function () {});
      refreshStatus().catch(function () {});
      updateComposer();
    });
    window.addEventListener('offline', function () {
      S.offline = true;
      updateComposer();
      toast('أنت غير متصل. ستُحفظ المحادثات محليًا.', 'err');
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) el('overlay').classList.remove('show');
      if (window.innerWidth >= 1180) el('wsOverlay').classList.remove('show');
      if (window.innerWidth <= 900) el('sidebar').classList.add('collapsed');
    });
  }

  /* ==========================================================================
     الميكروفون
     ========================================================================== */
  function toggleMic() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { toast('التعرّف على الصوت غير مدعوم في هذا المتصفح. جرّب Chrome أو Edge.', 'err'); return; }
    if (S.recognition) {
      try { S.recognition.stop(); } catch (e) { /* ignore */ }
      return;
    }
    const rec = new Recognition();
    rec.lang = 'ar-SA';
    rec.interimResults = true;
    rec.continuous = false;
    const base = el('input').value;
    rec.onstart = function () { S.recording = true; updateComposer(); toast('تحدّث الآن…'); };
    rec.onresult = function (event) {
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      el('input').value = (base + ' ' + finalText + interim).trim();
      resizeInput();
      updateComposer();
    };
    rec.onerror = function (event) {
      if (event.error === 'not-allowed') toast('اسمح للمتصفح باستخدام الميكروفون', 'err');
      else if (event.error !== 'aborted') toast('تعذّر التسجيل: ' + event.error, 'err');
    };
    rec.onend = function () {
      S.recording = false;
      S.recognition = null;
      updateComposer();
    };
    S.recognition = rec;
    try { rec.start(); } catch (e) { toast('تعذّر بدء التسجيل', 'err'); S.recognition = null; }
  }

  /* ==========================================================================
     الإقلاع
     ========================================================================== */
  async function init() {
    paintIcons(document);
    loadState();
    applyTheme();
    S.models = FALLBACK_MODELS.slice();
    if (window.innerWidth <= 900) el('sidebar').classList.add('collapsed');
    el('taskDue').min = localDateTimeValue(new Date());
    el('taskDue').value = localDateTimeValue(new Date(Date.now() + 3600_000));
    el('adminLink').hidden = true;
    renderChatList();
    renderThread();
    renderNotes();
    renderLibrary();
    renderTasks();
    renderLog();
    renderAccount();
    renderProfile();
    renderSettingsToggles();
    renderAttachments();
    updateComposer();
    renderModelMenu();
    renderTempButton();
    updateUsage();
    updateDemoBadge();
    bindEvents();
    setInterval(checkTasks, 30_000);
    setTimeout(checkTasks, 2500);
    try {
      await refreshMe();
    } catch (e) {
      S.offline = true;
      updateComposer();
      toast('تعذّر الاتصال بالخادم — وضع محلي فقط. ' + e.message, 'err', 5200);
    }
    loadModels();
    refreshStatus().catch(function () {});
    if (S.me) {
      await mergeServerChats();
    }
    if (S.activeId) {
      const chat = S.chats.find(function (c) { return c.id === S.activeId; });
      if (chat && !chat.msgs) await openChat(chat.id);
    }
    if (!S.me) updateDemoBadge();
    handleUrlParams();
    registerServiceWorker();
    if (S.activeId) {
      const c = S.chats.find(function (x) { return x.id === S.activeId; });
      if (c && c.msgs && c.msgs.length) { renderThread(); requestAnimationFrame(scrollBottom); }
    }
  }

  function handleUrlParams() {
    let url;
    try { url = new URL(window.location.href); } catch (e) { return; }
    const auth = url.searchParams.get('auth');
    const reason = url.searchParams.get('reason');
    if (auth === 'success') {
      toast('تم تسجيل الدخول بنجاح', 'ok');
      refreshMe().then(function () { return mergeServerChats(); }).then(function () { renderChatList(); }).catch(function () {});
    } else if (auth === 'failed') {
      toast('تعذّر تسجيل الدخول عبر Google' + (reason ? ' (' + reason + ')' : ''), 'err', 5200);
    } else if (auth === 'unconfigured') {
      toast('الدخول عبر Google غير مهيأ على الخادم', 'err', 4200);
    } else if (auth === 'cancelled') {
      toast('أُلغيت عملية تسجيل الدخول', '', 2600);
    }
    const checkout = url.searchParams.get('checkout');
    if (checkout === 'success') {
      const sessionId = url.searchParams.get('session_id');
      toast('تم الدفع — جارٍ تفعيل الاشتراك…', 'ok', 5000);
      const activate = sessionId
        ? jsonApi('/api/billing/sync', { method: 'POST', body: { sessionId: sessionId } })
        : Promise.reject(new Error('لا يوجد معرّف جلسة'));
      activate.then(function (data) {
        toast('تم تفعيل خطة ' + planLabel(data.plan) + ' بنجاح', 'ok', 5000);
        return refreshMe();
      }).catch(function (err) {
        if (sessionId) toast('تم الدفع، وسيُفعّل الاشتراك عبر Webhook خلال لحظات. ' + (err && err.message ? err.message : ''), '', 6000);
        setTimeout(function () { refreshMe().catch(function () {}); }, 4000);
      });
    } else if (checkout === 'cancel') {
      toast('أُلغيت عملية الدفع', '', 2600);
    }
    const chatId = url.searchParams.get('chat');
    if (chatId) setTimeout(function () { openChat(chatId); }, 500);
    if (auth || checkout || chatId) {
      try { history.replaceState({}, '', url.pathname); } catch (e) { /* ignore */ }
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:') return;
    if (/(^|\.)e2b\.app$/i.test(location.hostname) || /^(localhost|127\.0\.0\.1)$/i.test(location.hostname)) return;
    navigator.serviceWorker.register('/sw.js').catch(function () { /* ignore */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
