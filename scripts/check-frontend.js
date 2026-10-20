#!/usr/bin/env node
'use strict';
/* فحص سريع: صحة صياغة كل ملفات JS، وجود الأصول، وتطابق معرّفات HTML مع app.js */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const problems = [];
const notes = [];
let checked = 0;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'data', 'security_logs'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(root);
for (const file of files.filter((f) => f.endsWith('.js') && !f.endsWith('.min.js'))) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    checked += 1;
  } catch (err) {
    problems.push(`صياغة JS خاطئة: ${path.relative(root, file)}\n${err.stderr || err.message}`);
  }
}

const htmlFiles = files.filter((f) => f.endsWith('.html'));
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  if (!/<!doctype html>/i.test(html)) problems.push(`لا يوجد doctype: ${path.relative(root, file)}`);
  for (const m of html.matchAll(/(?:src|href)="(\/(?:assets|icons)\/[^"]+)"/g)) {
    const target = path.join(root, 'public', m[1]);
    if (!fs.existsSync(target)) problems.push(`أصل مفقود ${m[1]} في ${path.relative(root, file)}`);
  }
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const dup of ids) {
    const count = [...html.matchAll(new RegExp(`\\sid="${dup}"`, 'g'))].length;
    if (count > 1) problems.push(`معرّف مكرر ${dup} في ${path.relative(root, file)}`);
  }
}

const appPath = path.join(root, 'public/assets/app.js');
if (fs.existsSync(appPath)) {
  const js = fs.readFileSync(appPath, 'utf8');
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const dynamic = new Set(['authStatus', 'emailStep1', 'emailStep2', 'loginCode', 'loginEmail', 'loginEmailLabel', 'codeSentNote', 'upgradeStatus']);
  const refs = new Set();
  for (const m of js.matchAll(/\bel\(\s*'([^']+)'/g)) refs.add(m[1]);
  for (const m of js.matchAll(/\$\('#([^']+)'\)/g)) refs.add(m[1]);
  for (const m of js.matchAll(/getElementById\('([^']+)'\)/g)) refs.add(m[1]);
  const missing = [...refs].filter((id) => !ids.has(id) && !dynamic.has(id));
  if (missing.length) problems.push('معرّفات مطلوبة في app.js وغير موجودة في HTML: ' + missing.join(', '));
  notes.push(`app.js: ${refs.size} معرّفًا، ${ids.size} عنصرًا في الصفحة`);
}

for (const file of files.filter((f) => f.endsWith('.css'))) {
  const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  if (open !== close) problems.push(`أقواس CSS غير متوازنة (${open}/${close}): ${path.relative(root, file)}`);
}

for (const page of ['index.html', 'admin.html']) {
  const p = path.join(root, 'public', page);
  if (!fs.existsSync(p)) problems.push(`صفحة مفقودة: public/${page}`);
}

console.log(`✓ فُحص ${checked} ملف JavaScript و${htmlFiles.length} ملف HTML`);
notes.forEach((n) => console.log('· ' + n));
if (problems.length) {
  console.error('\n✗ مشاكل:');
  problems.forEach((p) => console.error(' - ' + p));
  process.exit(1);
}
console.log('✓ لا توجد مشاكل — الواجهة والخادم جاهزان');
