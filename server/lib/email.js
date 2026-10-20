'use strict';

const config = require('../config');
const { escapeHtml } = require('./util');

let transporter = null;
let lastError = '';

function getTransporter() {
  if (!config.email.enabled) return null;
  if (transporter) return transporter;
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: { user: config.email.user, pass: config.email.pass },
    pool: true,
    maxConnections: 2,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  transporter.on('error', (err) => { lastError = err.message; });
  return transporter;
}

async function send({ to, subject, text, html }) {
  if (!config.email.enabled) return { ok: false, skipped: true, error: 'البريد غير مهيأ' };
  try {
    const tx = getTransporter();
    const info = await tx.sendMail({
      from: `"${config.email.fromName}" <${config.email.fromAddr}>`,
      to,
      subject,
      text,
      html,
    });
    return { ok: true, id: info.messageId };
  } catch (err) {
    lastError = err.message;
    console.warn('[email] فشل الإرسال:', err.message);
    return { ok: false, error: err.message };
  }
}

function shell(title, bodyHtml) {
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f4f4f7;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e7e7ee">
    <div style="background:linear-gradient(120deg,#6d5efc,#22d3ee,#a855f7);padding:22px 26px;color:#fff">
      <div style="font-size:20px;font-weight:700">Cosmos</div>
      <div style="opacity:.85;font-size:13px;margin-top:4px">مساحة واحدة لكل أفكارك</div>
    </div>
    <div style="padding:26px;color:#16161d;line-height:1.8">
      <h2 style="margin:0 0 14px;font-size:19px">${escapeHtml(title)}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:14px 26px;background:#fafafd;color:#8a8a99;font-size:12px;border-top:1px solid #eee">
      وصلت هذه الرسالة لأنك استخدمت Cosmos. إذا لم تكن أنت، تجاهلها.
    </div>
  </div></body></html>`;
}

async function sendLoginCode(to, code, name) {
  const html = shell('رمز الدخول إلى Cosmos', `
    <p>مرحبًا ${escapeHtml(name || '')}،</p>
    <p>رمز الدخول الخاص بك صالح لمدة <b>10 دقائق</b>:</p>
    <div style="text-align:center;margin:24px 0">
      <div style="display:inline-block;font-size:34px;letter-spacing:10px;font-weight:800;background:#f2f0ff;color:#4b3fd6;padding:14px 26px;border-radius:14px;direction:ltr">${code}</div>
    </div>
    <p style="color:#6b6b7b;font-size:13px">إذا لم تطلب الدخول، يمكنك تجاهل هذه الرسالة بأمان.</p>
  `);
  return send({
    to,
    subject: `رمز الدخول إلى Cosmos: ${code}`,
    text: `رمز الدخول إلى Cosmos هو ${code}. صالح لمدة 10 دقائق.`,
    html,
  });
}

async function sendWelcome(to, name) {
  const html = shell('أهلًا بك في Cosmos', `
    <p>مرحبًا ${escapeHtml(name || '')} 👋</p>
    <p>حسابك جاهز. يمكنك الآن الدردشة مع النماذج، إرفاق الصور والملفات، وحفظ محادثاتك والوصول إليها من أي جهاز.</p>
    <p style="margin:22px 0"><a href="${escapeHtml(config.appUrl || '')}" style="background:#6d5efc;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;display:inline-block">ابدأ الدردشة</a></p>
    <p style="color:#6b6b7b;font-size:13px">نصيحة: استخدم Ctrl+K للبحث في محادثاتك، وزر الميكروفون للكتابة بالصوت.</p>
  `);
  return send({ to, subject: 'أهلًا بك في Cosmos', text: 'تم إنشاء حسابك في Cosmos بنجاح.', html });
}

async function sendFeedback({ name, email, message, userId }) {
  const html = shell('ملاحظة جديدة من مستخدم', `
    <p><b>الاسم:</b> ${escapeHtml(name || 'غير مذكور')}</p>
    <p><b>البريد:</b> ${escapeHtml(email || 'غير مذكور')}</p>
    <p><b>المعرّف:</b> <span dir="ltr">${escapeHtml(userId || '')}</span></p>
    <div style="background:#fafafd;border:1px solid #eee;border-radius:12px;padding:14px;white-space:pre-wrap">${escapeHtml(message)}</div>
  `);
  return send({
    to: config.email.adminEmail,
    subject: 'Cosmos — ملاحظة مستخدم',
    text: `${name || ''} (${email || ''})\n${message}`,
    html,
  });
}

function info() {
  return {
    configured: config.email.enabled,
    host: config.email.enabled ? `${config.email.host}:${config.email.port}` : null,
    user: config.email.enabled ? config.email.user : null,
    lastError: lastError || undefined,
  };
}

module.exports = { send, sendLoginCode, sendWelcome, sendFeedback, info };
