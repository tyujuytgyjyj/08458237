'use strict';
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
    const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const raw of list) {
      const pair = raw.split(';')[0];
      const i = pair.indexOf('=');
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
      if (!/httponly/i.test(raw) && win) { try { win.document.cookie = pair + '; path=/'; } catch (_) {} }
    }
    return res;
  };
}
async function open(path, jar) {
  const dom = await JSDOM.fromURL(base + path, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.fetch = makeFetch(jar, w);
      w.TextDecoder = TextDecoder; w.TextEncoder = TextEncoder; w.AbortController = AbortController;
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
      w.confirm = () => true;
      w.console.error = (...a) => errors.push('console.error: ' + a.join(' '));
      w.console.warn = () => {};
      w.addEventListener('error', (e) => errors.push('error: ' + (e.message || '')));
      w.addEventListener('unhandledrejection', (e) => errors.push('rejection: ' + (e.reason && e.reason.message || e.reason)));
    },
  });
  await new Promise((r) => setTimeout(r, 2200));
  return { dom, window: dom.window, doc: dom.window.document };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, timeout = 15000, step = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { const v = fn(); if (v) return v; } catch (_) {} await sleep(step); }
  return null;
}
(async () => {
  const fail = [], pass = [];
  const jar = new Map();
  let { window, doc } = await open('/', jar);
  const $ = (s) => doc.querySelector(s);
  const $$ = (s) => [...doc.querySelectorAll(s)];

  // chat + rename + star
  $('#input').value = 'اشرح لي الذكاء الاصطناعي ببساطة';
  $('#input').dispatchEvent(new window.Event('input', { bubbles: true }));
  $('#btnSend').click();
  const ans = await until(() => { const a = $$('.assistant-msg .answer'); return a.length && a[a.length - 1].textContent.trim().length > 30 && a[a.length - 1]; }, 20000);
  if (!ans) fail.push('no answer'); else pass.push('answer ok (' + ans.textContent.trim().length + ' chars)');

  const ren = await until(() => $('[data-rename]'), 5000);
  if (!ren) fail.push('rename button missing');
  else {
    ren.click(); await sleep(300);
    if ($('#askModal').classList.contains('hidden')) fail.push('rename modal not open');
    else {
      $('#askInput').value = 'عنوان مخصص للاختبار';
      $('#askOk').click(); await sleep(500);
      pass.push('renamed=' + ($('.chat-item .title') || {}).textContent);
      if (!($('#chatList').textContent || '').includes('عنوان مخصص')) fail.push('rename not applied');
    }
  }

  // tasks with due
  $('[data-open="tasks"]').click(); await sleep(300);
  const d = new Date(Date.now() + 3600e3);
  const pad = (n) => String(n).padStart(2, '0');
  $('#taskText').value = 'مراجعة تقرير';
  $('#taskDue').value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  $('#btnAddTask').click(); await sleep(300);
  const tasks = $$('#tasksList .task-card').length;
  pass.push('tasks=' + tasks);
  if (!tasks) fail.push('task not added');

  // images
  $('[data-open="images"]').click(); await sleep(300);
  if ($('#imagesModal').classList.contains('hidden')) fail.push('images modal not open');
  $('#imagePrompt').value = 'مدينة عربية مستقبلية عند الغروب';
  $('#btnGenerateImage').click();
  const img = await until(() => $('#imageResult img'), 25000);
  if (!img) fail.push('image not generated: ' + ($('#imageResult').textContent || '').trim().slice(0, 100));
  else pass.push('image ok ' + (img.src || '').slice(0, 30) + '…');
  $('#imageClose').click(); await sleep(200);

  // email login
  $('#accountBtn').click(); await sleep(600);
  const email = 'flow' + Date.now() + '@example.com';
  const li = await until(() => $('#loginEmail'), 4000);
  if (!li) fail.push('login form missing');
  else {
    li.value = email;
    $('#accountBody [data-auth="send-code"]').click();
    const codeInput = await until(() => $('#loginCode') && $('#loginCode').value, 15000);
    if (!codeInput) fail.push('login code not shown: ' + ($('#authStatus').textContent || '').trim().slice(0, 120));
    else {
      pass.push('code autofilled=' + codeInput);
      $('#accountBody [data-auth="verify"]').click();
      const name = await until(() => {
        const t = ($('#sbName').textContent || '').trim();
        return t && !/زائر/.test(t) ? t : null;
      }, 15000);
      pass.push('logged in as=' + (name || ($('#sbName').textContent || '').trim()) + ' usage=' + $('#usageChip').textContent.trim());
      if (!name) fail.push('login did not complete in UI');
      if (!$('#usageChip').textContent.includes('200')) fail.push('free quota not shown');
    }
  }
  if (!$('#accountModal').classList.contains('hidden')) $('#accountClose').click();
  await sleep(1200);

  // server-side chat persisted
  const cookie = [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ');
  const chatsRes = await fetch(base + '/api/chats', { headers: { cookie } });
  const chats = await chatsRes.json();
  pass.push('server chats=' + (chats.chats || []).length);
  if (!(chats.chats || []).length) fail.push('chat not synced to server');

  // reload same session
  window.close();
  ({ window, doc } = await open('/', jar));
  const $2 = (s) => doc.querySelector(s);
  const reloaded = await until(() => doc.querySelectorAll('#chatList .chat-item').length, 8000);
  const reloadedTitle = (doc.querySelector('#chatList .chat-item .title') || {}).textContent || '';
  pass.push('after reload chats=' + reloaded + ' title=' + reloadedTitle);
  if (!reloaded) fail.push('chats not restored after reload');
  if (reloaded && !reloadedTitle.includes('عنوان مخصص')) fail.push('custom title lost after reload');

  // delete chat via UI
  const del = await until(() => doc.querySelector('[data-del]'), 5000);
  if (del) {
    del.click(); await sleep(300);
    if (doc.querySelector('#confirmModal').classList.contains('hidden')) fail.push('confirm not open');
    else { doc.querySelector('#confirmOk').click(); await sleep(900); }
    pass.push('after delete chats=' + doc.querySelectorAll('#chatList .chat-item').length);
  }
  const me = await fetch(base + '/api/me', { headers: { cookie } }).then((r) => r.json());
  pass.push('me=' + (me.user && me.user.email) + ' plan=' + me.plan);
  if (!me.user) fail.push('session lost after reload');

  window.close();
  pass.push('errors=' + (errors.length ? JSON.stringify(errors.slice(0, 4)) : 'none'));
  if (errors.length) fail.push('js errors: ' + errors.length);
  console.log(pass.map((p) => '✓ ' + p).join('\n'));
  if (fail.length) { console.log('\n✗ FAIL:\n' + fail.map((f) => ' - ' + f).join('\n')); process.exitCode = 1; }
  else console.log('\nALL FLOW CHECKS PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
