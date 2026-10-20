/* Cosmos — لوحة الإدارة (vanilla) */
(function () {
  'use strict';

  var SECRET_KEY = 'cosmos.admin.secret';
  var THEME_KEY = 'cosmos.admin.theme';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var secret = '';

  var ICONS = {
    activity: '<path d="M3 12h4l2.5-7 4 14 2.5-7H21"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8 3 3-2 2 2 2-3 3-2-2-2 2"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    logout: '<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/>',
    download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  };
  function icon(name, size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(n) {
    try { return new Intl.NumberFormat('ar').format(Number(n) || 0); } catch (_) { return String(n || 0); }
  }
  function when(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d)) return '—';
    try { return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(d); } catch (_) { return d.toISOString(); }
  }

  var toasts = $('#toasts');
  function toast(msg, kind) {
    if (!toasts) return;
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = icon(kind === 'err' ? 'close' : 'check', 16) + '<span>' + esc(msg) + '</span>';
    toasts.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 3200);
    setTimeout(function () { t.remove(); }, 3600);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
    $$('[data-icon="moon"]').forEach(function (el) { el.innerHTML = icon(theme === 'light' ? 'sun' : 'moon', 18); });
  }
  ICONS.sun = '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>';

  function paintIcons(root) {
    $$('[data-icon]', root).forEach(function (el) {
      if (el.dataset.painted) return;
      el.innerHTML = icon(el.dataset.icon, el.dataset.size);
      el.dataset.painted = '1';
    });
    $$('[data-logo]').forEach(function (el) {
      if (el.dataset.painted) return;
      el.innerHTML = '<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#6D5EFC"/><path d="M44 23.5A13.5 13.5 0 1 0 44 40.5" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>';
      el.dataset.painted = '1';
    });
  }

  /* ------------------------------ API ------------------------------ */
  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'x-admin-secret': secret, 'Accept': 'application/json' }, opts.headers || {});
    if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    return fetch(path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }
        if (!res.ok) {
          var err = new Error((data && (data.error && data.error.message || data.message)) || ('HTTP ' + res.status));
          err.status = res.status;
          err.code = data && data.error && data.error.code;
          throw err;
        }
        return data;
      });
    });
  }

  function fail(err) {
    if (err.status === 401 || err.code === 'admin_auth' || err.status === 404) {
      signOut(true);
      toast(err.status === 404 ? 'لوحة الإدارة غير مفعّلة على الخادم.' : 'انتهت الجلسة — أدخل المفتاح مجددًا.', 'err');
      return;
    }
    toast(err.message || 'حدث خطأ', 'err');
  }

  /* --------------------------- login / shell --------------------------- */
  function showLogin() {
    $('#loginView').classList.remove('hidden');
    $('#appView').classList.add('hidden');
    setTimeout(function () { var i = $('#adminSecret'); if (i) i.focus(); }, 60);
  }
  function showApp() {
    $('#loginView').classList.add('hidden');
    $('#appView').classList.remove('hidden');
    loadTab('overview');
  }
  function signOut(silent) {
    secret = '';
    try { sessionStorage.removeItem(SECRET_KEY); } catch (_) {}
    showLogin();
    if (!silent) toast('تم تسجيل الخروج');
  }
  function verify(s) {
    secret = s;
    return api('/api/admin/check').then(function () {
      try { sessionStorage.setItem(SECRET_KEY, s); } catch (_) {}
      showApp();
    }).catch(function (err) {
      secret = '';
      try { sessionStorage.removeItem(SECRET_KEY); } catch (_) {}
      $('#loginError').innerHTML = '<div class="form-error">' + esc(err.status === 404 ? 'لوحة الإدارة غير مفعّلة.' : 'المفتاح غير صحيح.') + '</div>';
    });
  }

  /* ------------------------------ tabs ------------------------------ */
  var TITLES = {
    overview: ['نظرة عامة', 'حالة Cosmos وإحصاءات الاستخدام'],
    users: ['المستخدمون', 'إدارة الحسابات والخطط'],
    security: ['الحظر والأمان', 'الحظر وقوائم الحجب وسجلات الحماية'],
    events: ['الأحداث', 'سجل نشاط المنصة'],
    diagnostics: ['التشخيص', 'فحص التكاملات والاتصال'],
  };
  var loaded = {};
  function loadTab(tab) {
    document.title = 'لوحة إدارة Cosmos — ' + TITLES[tab][0];
    $('#pageTitle').textContent = TITLES[tab][0];
    $('#pageSub').textContent = TITLES[tab][1];
    $$('.admin-nav [data-tab]').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    $$('main > section').forEach(function (s) { s.classList.add('hidden'); });
    var node = $('#tab-' + tab);
    if (node) node.classList.remove('hidden');
    if (tab === 'overview' && !loaded.overview) { loaded.overview = true; loadOverview(); }
    if (tab === 'users' && !loaded.users) { loaded.users = true; loadUsers(); }
    if (tab === 'security' && !loaded.security) { loaded.security = true; loadSecurity(); }
    if (tab === 'events' && !loaded.events) { loaded.events = true; loadEvents(); }
    if (tab === 'diagnostics' && !loaded.diagnostics) { loaded.diagnostics = true; loadDiagnostics(); }
  }

  /* ---------------------------- overview ---------------------------- */
  function loadOverview() {
    api('/api/admin/overview').then(function (d) {
      var stats = [
        ['المستخدمون', num(d.users.total), 'جديد اليوم: ' + num(d.users.newToday)],
        ['نشطون اليوم', num(d.usage.activeUsersToday), 'رسائل: ' + num(d.usage.messagesToday)],
        ['المحادثات', num(d.chats), 'جلسات: ' + num(d.sessions)],
        ['مستخدمون موقوفون', num(d.users.disabled), 'حظر نشط: ' + num((d.bans && (d.bans.active || d.bans.length)) || 0)],
        ['توكِنات دخل', num(d.usage.tokensIn), 'توكِنات خرج: ' + num(d.usage.tokensOut)],
        ['أحداث Stripe', num(d.stripeEvents), 'التخزين: ' + esc(d.storage.driver)],
      ];
      $('#statsGrid').innerHTML = stats.map(function (s) {
        return '<div class="stat"><span>' + esc(s[0]) + '</span><b>' + s[1] + '</b><small>' + s[2] + '</small></div>';
      }).join('');

      var plans = d.users.plans || {};
      $('#planStats').innerHTML = ['free', 'premium', 'pro'].map(function (p) {
        var label = p === 'free' ? 'مجاني' : p === 'premium' ? 'مميز' : 'احترافي';
        return '<div><b>' + label + '</b><span style="font-size:18px;font-weight:700">' + num(plans[p] || 0) + '</span></div>';
      }).join('') +
        '<div><b>حالة الذكاء الاصطناعي</b><code>' + (d.ai.demo ? 'وضع تجريبي' : 'جاهز') + '</code></div>' +
        '<div><b>حماية CLI</b><code>' + esc(d.security.antiCli) + ' · قائمة الحجب: ' + num(d.security.threatList) + '</code></div>';

      renderEvents($('#recentEvents'), (d.events || []).slice(0, 8));
    }).catch(fail);
  }

  /* ----------------------------- users ----------------------------- */
  var userQuery = '';
  function loadUsers() {
    var body = $('#usersBody');
    body.innerHTML = '<tr><td colspan="5"><div class="loading-line"><span class="spinner"></span> تحميل…</div></td></tr>';
    api('/api/admin/users?limit=100&q=' + encodeURIComponent(userQuery)).then(function (d) {
      $('#userCount').textContent = 'الإجمالي: ' + num(d.total);
      if (!d.users.length) {
        body.innerHTML = '<tr><td colspan="5"><div class="empty-admin">لا يوجد مستخدمون بعد. تظهر هنا الحسابات التي تسجّل الدخول بجوجل أو بالبريد.</div></td></tr>';
        return;
      }
      body.innerHTML = d.users.map(function (u) {
        var name = u.name || (u.email ? u.email.split('@')[0] : 'مستخدم');
        return '<tr data-id="' + esc(u.id) + '">' +
          '<td><div style="display:flex;align-items:center;gap:8px"><span class="avatar sm" style="background:' + (u.picture ? 'transparent' : 'var(--accent)') + '">' + (u.picture ? '<img src="' + esc(u.picture) + '" alt="" style="width:100%;height:100%;border-radius:inherit;object-fit:cover">' : esc(name.charAt(0).toUpperCase())) + '</span><div><div style="font-weight:600">' + esc(name) + '</div><div class="em" style="font-size:10.5px">' + esc(u.email || u.id) + '</div></div></div></td>' +
          '<td><select class="mini-select" data-plan="' + esc(u.id) + '" aria-label="الخطة">' + ['free', 'premium', 'pro'].map(function (p) {
            return '<option value="' + p + '"' + (u.plan === p ? ' selected' : '') + '>' + (p === 'free' ? 'مجاني' : p === 'premium' ? 'مميز' : 'احترافي') + '</option>';
          }).join('') + '</select></td>' +
          '<td>' + (u.disabled ? '<span class="pill red">موقوف</span>' : '<span class="pill green">نشط</span>') + (u.planStatus ? ' <span class="pill muted">' + esc(u.planStatus) + '</span>' : '') + '</td>' +
          '<td style="font-size:10.5px;color:var(--muted)">' + when(u.lastLoginAt) + '<div style="color:var(--faint)">' + esc(u.provider || '') + '</div></td>' +
          '<td><div class="actions">' +
            '<button class="btn xs" data-toggle="' + esc(u.id) + '" data-disabled="' + (u.disabled ? '1' : '0') + '">' + (u.disabled ? 'تفعيل' : 'إيقاف') + '</button>' +
            '<button class="btn xs" data-ban="' + esc(u.id) + '">حظر</button>' +
            '<button class="btn xs danger" data-del="' + esc(u.id) + '">حذف</button>' +
          '</div></td></tr>';
      }).join('');
    }).catch(function (err) { body.innerHTML = '<tr><td colspan="5"><div class="empty-admin">' + esc(err.message) + '</div></td></tr>'; fail(err); });
  }

  function removeUser(id) {
    if (!window.confirm('حذف هذا المستخدم نهائيًا مع محادثاته؟')) return;
    api('/api/admin/users/' + encodeURIComponent(id), { method: 'DELETE' }).then(function () {
      toast('تم حذف المستخدم');
      loadUsers(); loadOverview();
    }).catch(fail);
  }

  /* ---------------------------- security ---------------------------- */
  function loadSecurity() {
    api('/api/admin/bans').then(function (d) {
      var list = d.bans || [];
      $('#bansBody').innerHTML = list.length ? list.map(function (b) {
        var target = b.ip || b.userId || '—';
        return '<tr><td>' + (b.ip ? 'IP' : 'مستخدم') + '</td><td class="em">' + esc(target) + '</td><td style="font-size:10.5px">' + when(b.until) + '</td><td>' + esc(b.reason || '—') + '</td><td><button class="btn xs" data-unban-ip="' + esc(b.ip || '') + '" data-unban-user="' + esc(b.userId || '') + '">رفع</button></td></tr>';
      }).join('') : '<tr><td colspan="5"><div class="empty-admin">لا يوجد حظر نشط.</div></td></tr>';
    }).catch(fail);

    api('/api/admin/security/log?tail=120').then(function (d) {
      var entries = (d.entries || []).slice().reverse();
      $('#securityLog').innerHTML = entries.length ? entries.map(function (e) {
        return '<div class="log-line">' + esc(e.raw || (e.at ? '[' + e.at + '] ' : '') + (e.type || e.event || '') + ' ' + (e.ip || '') + ' ' + (e.path || '') + ' ' + (e.reason || e.reasonCode || '') + ' ' + (e.ua ? '| ' + e.ua : '')) + '</div>';
      }).join('') : '<div class="empty-admin">لا توجد محاولات مرفوضة مسجّلة.</div>';
    }).catch(fail);
  }

  /* ----------------------------- events ----------------------------- */
  function renderEvents(node, events) {
    if (!node) return;
    if (!events || !events.length) { node.innerHTML = '<div class="empty-admin">لا توجد أحداث بعد.</div>'; return; }
    node.innerHTML = events.map(function (e) {
      var meta = [];
      if (e.ip) meta.push(e.ip);
      if (e.userId) meta.push(e.userId);
      const detail = e.detail !== undefined ? e.detail : e.data;
      return '<div class="event-row"><span class="type">' + esc(e.type || e.event || '—') + '</span><span style="color:var(--muted);font-size:11px">' + esc(detail ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '') + '</span><span class="meta">' + when(e.at) + (meta.length ? ' · ' + esc(meta.join(' · ')) : '') + '</span></div>';
    }).join('');
  }
  function loadEvents() {
    api('/api/admin/events?limit=120').then(function (d) { renderEvents($('#eventsList'), d.events); }).catch(fail);
  }

  /* --------------------------- diagnostics --------------------------- */
  function kvRender(obj) {
    return '<div class="kv">' + Object.keys(obj).map(function (k) {
      var v = obj[k];
      var text = v && typeof v === 'object' ? JSON.stringify(v) : String(v);
      return '<div><b>' + esc(k) + '</b><code>' + esc(text) + '</code></div>';
    }).join('') + '</div>';
  }
  function loadDiagnostics(probe) {
    var box = $('#diagResult');
    if (!box) return;
    box.innerHTML = '<div class="loading-line"><span class="spinner"></span> فحص…</div>';
    api('/api/diagnostics' + (probe ? '?probe=1' : '')).then(function (d) {
      box.innerHTML =
        '<h2 style="font-size:13px;margin:0 0 8px">الذكاء الاصطناعي</h2>' + kvRender(d.ai || {}) +
        '<h2 style="font-size:13px;margin:16px 0 8px">Cosmos Photon 3</h2>' + kvRender(d.photon || {}) +
        '<h2 style="font-size:13px;margin:16px 0 8px">البنية</h2>' + kvRender({ storage: d.storage, redis: d.redis, email: d.email, stripe: d.stripe, oauth: d.oauth }) +
        '<h2 style="font-size:13px;margin:16px 0 8px">الأمان</h2>' + kvRender(d.security || {}) +
        '<details style="margin-top:14px"><summary style="cursor:pointer;font-size:11px;color:var(--muted)">JSON الكامل</summary><pre class="pre">' + esc(JSON.stringify(d, null, 2)) + '</pre></details>';
    }).catch(function (err) { box.innerHTML = '<div class="empty-admin">' + esc(err.message) + '</div>'; fail(err); });
  }

  /* ------------------------------ wire ------------------------------ */
  function init() {
    try { var t = localStorage.getItem(THEME_KEY); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch (_) {}
    paintIcons();
    $('#themeBtn').addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
    });
    applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');

    $('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var val = $('#adminSecret').value.trim();
      if (!val) return;
      $('#loginError').innerHTML = '';
      var btn = $('#loginBtn');
      btn.disabled = true;
      btn.textContent = 'جارٍ التحقق…';
      verify(val).finally(function () { btn.disabled = false; btn.textContent = 'دخول'; });
    });
    $('#logoutBtn').addEventListener('click', function () { signOut(); });
    $$('.admin-nav [data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { loadTab(b.dataset.tab); });
    });
    $('#refreshBtn').addEventListener('click', function () {
      var tab = $('.admin-nav .active').dataset.tab;
      if (tab === 'overview') loadOverview();
      else if (tab === 'users') loadUsers();
      else if (tab === 'security') loadSecurity();
      else if (tab === 'events') loadEvents();
      else loadDiagnostics();
      toast('تم التحديث');
    });
    $('#exportBtn').addEventListener('click', function () {
      fetch('/api/admin/export/users.csv', { headers: { 'x-admin-secret': secret }, credentials: 'same-origin' })
        .then(function (r) {
          if (!r.ok) throw new Error('فشل التصدير');
          return r.blob();
        })
        .then(function (blob) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'cosmos-users-' + new Date().toISOString().slice(0, 10) + '.csv';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        }).catch(fail);
    });

    $('#userSearchBtn').addEventListener('click', function () { userQuery = $('#userQuery').value.trim(); loadUsers(); });
    $('#userQuery').addEventListener('keydown', function (e) { if (e.key === 'Enter') { userQuery = e.target.value.trim(); loadUsers(); } });
    $('#usersBody').addEventListener('change', function (e) {
      var sel = e.target.closest('[data-plan]');
      if (!sel) return;
      api('/api/admin/users/' + encodeURIComponent(sel.dataset.plan) + '/plan', { method: 'POST', body: { plan: sel.value } })
        .then(function () { toast('تم تحديث الخطة'); loadOverview(); })
        .catch(function (err) { fail(err); loadUsers(); });
    });
    $('#usersBody').addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.toggle) {
        api('/api/admin/users/' + encodeURIComponent(btn.dataset.toggle) + '/disable', { method: 'POST', body: { disabled: btn.dataset.disabled !== '1', reason: 'إجراء إداري' } })
          .then(function () { toast('تم تحديث الحالة'); loadUsers(); loadOverview(); })
          .catch(fail);
      } else if (btn.dataset.ban) {
        api('/api/admin/ban', { method: 'POST', body: { userId: btn.dataset.ban, hours: 24, reason: 'حظر إداري' } })
          .then(function () { toast('تم حظر المستخدم'); loadSecurity(); })
          .catch(fail);
      } else if (btn.dataset.del) {
        removeUser(btn.dataset.del);
      }
    });

    $('#banForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var ip = $('#banIp').value.trim();
      var userId = $('#banUser').value.trim();
      if (!ip && !userId) return toast('أدخل IP أو معرّف مستخدم', 'err');
      api('/api/admin/ban', { method: 'POST', body: { ip: ip || undefined, userId: userId || undefined, hours: Number($('#banHours').value) || 24, reason: $('#banReason').value.trim() } })
        .then(function () { toast('تم الحظر'); $('#banForm').reset(); $('#banHours').value = 24; loadSecurity(); })
        .catch(fail);
    });
    $('#bansBody').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-unban-ip]');
      if (!btn) return;
      var qs = [];
      if (btn.dataset.unbanIp) qs.push('ip=' + encodeURIComponent(btn.dataset.unbanIp));
      if (btn.dataset.unbanUser) qs.push('userId=' + encodeURIComponent(btn.dataset.unbanUser));
      api('/api/admin/ban?' + qs.join('&'), { method: 'DELETE' })
        .then(function () { toast('تم رفع الحظر'); loadSecurity(); })
        .catch(fail);
    });
    $('#reloadBlocklistBtn').addEventListener('click', function () {
      var b = this; b.disabled = true;
      api('/api/admin/blocklist/reload', { method: 'POST' }).then(function (d) {
        toast('تم التحديث: ' + (d.threatList.ips || 0) + ' عنوان');
        loadSecurity();
      }).catch(fail).finally(function () { b.disabled = false; });
    });
    $('#probeBtn').addEventListener('click', function () { loadDiagnostics(true); });
    $('#diagReloadBtn').addEventListener('click', function () { loadDiagnostics(); });
    $('#testEmailBtn').addEventListener('click', function () {
      var to = $('#testEmailTo').value.trim();
      if (!to) return toast('أدخل بريدًا', 'err');
      var b = this; b.disabled = true;
      api('/api/diagnostics/test-email', { method: 'POST', body: { to: to } })
        .then(function (d) { $('#emailTestResult').innerHTML = '<div class="hint-sm" style="color:var(--green)">' + esc(d.message || 'تم إرسال رسالة الاختبار') + '</div>'; })
        .catch(fail).finally(function () { b.disabled = false; });
    });

    var saved = null;
    try { saved = sessionStorage.getItem(SECRET_KEY); } catch (_) {}
    if (saved) verify(saved); else showLogin();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
