'use strict';
/* فحص واجهة Cosmos عبر jsdom مقابل خادم يعمل على :4000 */
const { JSDOM, VirtualConsole } = require('jsdom');
require('dotenv').config({ quiet: true });
const base = process.env.SMOKE_BASE || 'http://127.0.0.1:4000';
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdom: ' + (e.stack || e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

function makeFetch(jar, win) {
  return async function (input, init) {
    init = init || {};
    const url = typeof input === 'string' ? new URL(input, base).href : input.url;
    const headers = new Headers(init.headers || {});
    if (jar.size) headers.set('cookie', [...jar.entries()].map(([k, v]) => k + '=' + v).join('; '));
    const res = await fetch(url, { ...init, headers, redirect: 'manual' });
    const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const raw of list) {
      const pair = raw.split(';')[0];
      const i = pair.indexOf('=');
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
      if (!/httponly/i.test(raw) && win) {
        try { win.document.cookie = pair + '; path=/'; } catch (_) {}
      }
    }
    return res;
  };
}

async function open(path) {
  const jar = new Map();
  const dom = await JSDOM.fromURL(base + path, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.fetch = makeFetch(jar, window);
      window.TextDecoder = TextDecoder;
      window.TextEncoder = TextEncoder;
      window.AbortController = AbortController;
      window.Blob = Blob;
      window.FormData = FormData;
      window.FileReader = class FileReader {
        readAsDataURL(blob) { blob.arrayBuffer().then((buf) => {
          this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(buf).toString('base64');
          if (this.onload) this.onload();
        }); }
      };
      window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.confirm = () => true;
      window.console.error = (...a) => errors.push('console.error: ' + a.join(' '));
      window.console.warn = () => {};
      window.addEventListener('error', (e) => errors.push('error: ' + (e.message || '')));
      window.addEventListener('unhandledrejection', (e) => errors.push('rejection: ' + (e.reason && e.reason.message || e.reason)));
    },
  });
  await new Promise((r) => setTimeout(r, 2200));
  return { dom, window: dom.window, doc: dom.window.document, jar };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, timeout = 12000, step = 200) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { const v = fn(); if (v) return v; } catch (_) {} await sleep(step); }
  return null;
}
function visible(el) { return el && !el.classList.contains('hidden') && el.offsetParent !== null; }

(async () => {
  const fail = [];
  const pass = [];
  const { dom, window, doc } = await open('/');
  const $ = (s) => doc.querySelector(s);
  const $$ = (s) => [...doc.querySelectorAll(s)];

  pass.push('title=' + doc.title);
  const name = await until(() => ($('#sbName').textContent || '').trim());
  pass.push('user=' + name + ' / ' + $('#usageChip').textContent.trim());
  if (!/زائر|Cosmos/.test(name)) fail.push('sidebar name not rendered');
  if ($$('#modelMenu .menu-item, .model-item').length === 0) fail.push('model menu empty');

  // send
  const input = $('#input');
  input.value = 'اكتب لي فقرة قصيرة عن الفضاء';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  $('#btnSend').click();
  const bubble = await until(() => {
    const msgs = $$('.assistant-msg');
    if (!msgs.length) return null;
    const el = msgs[msgs.length - 1].querySelector('.answer');
    return el && el.textContent.trim().length > 5 ? el : null;
  }, 20000, 300);
  if (!bubble) fail.push('assistant answer did not render');
  else {
    pass.push('answer=' + bubble.textContent.trim().slice(0, 90).replace(/\s+/g, ' '));
    if (/تعذّر|خطأ|فشل|error/i.test(bubble.textContent) && bubble.textContent.trim().length < 250) {
      pass.push('answer-looks-like-error (demo fallback?)');
    }
  }
  pass.push('chat items=' + $$('#chatList .chat-item').length);
  if ($$('#chatList .chat-item').length < 1) fail.push('chat not added to sidebar');

  // settings workspace
  const setOpen = $('[data-open="settings"]');
  if (setOpen) { setOpen.click(); await sleep(450); }
  if ($('#workspace').classList.contains('hidden')) fail.push('settings workspace did not open');
  else pass.push('settings workspace opened');

  // search
  $('#btnSearchSide').click(); await sleep(300);
  if ($('#searchModal').classList.contains('hidden')) fail.push('search did not open');
  else {
    const si = $('#searchInput'); si.value = 'الفضاء';
    si.dispatchEvent(new window.Event('input', { bubbles: true }));
    await sleep(300);
    pass.push('search results=' + $$('#searchResults .search-hit, #searchResults .sr-item, #searchResults button').length);
  }
  $('#btnSearchClose').click(); await sleep(200);

  // account
  $('#accountBtn').click(); await sleep(500);
  if ($('#accountModal').classList.contains('hidden')) fail.push('account modal did not open');
  else pass.push('account body login form=' + Boolean($('#loginEmail') || $('#accountBody').textContent.includes('Google')));
  $('#accountClose').click(); await sleep(200);

  // upgrade
  $('#btnUpgradeTop').click(); await sleep(700);
  if ($('#upgradeModal').classList.contains('hidden')) fail.push('upgrade did not open');
  else pass.push('plans=' + $$('#upgradeBody .plan-card, #upgradeBody .price-card').length + ' status=' + ($('#upgradeStatus') ? $('#upgradeStatus').textContent.trim().slice(0, 60) : ''));
  $('#upgradeClose').click(); await sleep(200);

  // workspace tasks
  $('[data-open="tasks"]').click(); await sleep(350);
  if ($('#workspace').classList.contains('hidden')) fail.push('workspace did not open');
  else {
    $('#taskText').value = 'مهمة اختبار';
    const due = new Date(Date.now() + 3600e3);
    const pad = (n) => String(n).padStart(2, '0');
    $('#taskDue').value = due.getFullYear() + '-' + pad(due.getMonth() + 1) + '-' + pad(due.getDate()) + 'T' + pad(due.getHours()) + ':' + pad(due.getMinutes());
    $('#btnAddTask').click(); await sleep(250);
    const taskCount = $$('#tasksList .task-card').length;
    pass.push('tasks=' + taskCount);
    if (!taskCount) fail.push('task not added');
  }

  // theme (settings tab)
  $('[data-open="settings"]').click(); await sleep(300);
  const before = doc.documentElement.getAttribute('data-theme');
  $('#setTheme').click(); await sleep(300);
  pass.push('theme ' + before + ' -> ' + doc.documentElement.getAttribute('data-theme'));
  if (before === doc.documentElement.getAttribute('data-theme')) fail.push('theme did not change');
  $('#btnWsClose').click(); await sleep(200);

  // new chat -> welcome state
  $('#btnNew').click(); await sleep(400);
  pass.push('new chat welcome=' + Boolean($('.empty-state, .welcome')) + ' thread msgs=' + $$('.msg').length);

  pass.push('errors=' + (errors.length ? JSON.stringify(errors.slice(0, 3)) : 'none'));
  if (errors.length) fail.push('console errors: ' + errors.length);
  window.close();

  // admin
  const adm = await open('/admin');
  const adoc = adm.doc;
  const secret = process.env.ADMIN_SECRET || process.env.RESTRICTION_ADMIN_SECRET;
  if (!secret) fail.push('ADMIN_SECRET env missing');
  else {
    adoc.querySelector('#adminSecret').value = secret;
    adoc.querySelector('#loginForm').dispatchEvent(new adm.window.Event('submit', { bubbles: true, cancelable: true }));
    const ok = await until(() => !adoc.querySelector('#appView').classList.contains('hidden'), 8000);
    if (!ok) fail.push('admin login failed: ' + (adoc.querySelector('#loginError')?.textContent || '').trim());
    else {
      const stats = await until(() => adoc.querySelectorAll('#statsGrid .stat').length, 8000);
      pass.push('admin stats=' + stats + ' users=' + (adoc.querySelector('#statsGrid .stat b')?.textContent || ''));
      adoc.querySelector('[data-tab="users"]').click(); await sleep(600);
      pass.push('admin users rows=' + adoc.querySelectorAll('#usersBody tr').length);
      adoc.querySelector('[data-tab="diagnostics"]').click(); await sleep(800);
      pass.push('diag chars=' + (adoc.querySelector('#diagResult').textContent || '').length);
    }
  }
  pass.push('admin errors=' + (errors.length ? JSON.stringify(errors.slice(-3)) : 'none'));
  adm.window.close();

  console.log(pass.map((p) => '✓ ' + p).join('\n'));
  if (fail.length) { console.log('\n✗ FAIL:\n' + fail.map((f) => ' - ' + f).join('\n')); process.exitCode = 1; }
  else console.log('\nALL UI CHECKS PASSED');
})();
