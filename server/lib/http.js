'use strict';

function apiError(res, status, message, extra = {}) {
  return res.status(status).json({
    error: {
      message,
      type: extra.type || (status === 429 ? 'rate_limit_exceeded' : status >= 500 ? 'server_error' : 'invalid_request_error'),
      code: extra.code || undefined,
      ...extra,
    },
  });
}

function openaiError(res, status, message, extra = {}) {
  return res.status(status).json({
    error: {
      message,
      type: extra.type || 'invalid_request_error',
      code: extra.code || null,
      param: null,
    },
  });
}

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function wantsJson(req) {
  if (req.path.startsWith('/api') || req.path.startsWith('/v1')) return true;
  const accept = String(req.get('accept') || '');
  return accept.includes('application/json') && !accept.includes('text/html');
}

function notFound(req, res) {
  if (wantsJson(req)) {
    return res.status(404).json({ error: { message: 'المسار غير موجود', type: 'not_found' } });
  }
  return res.status(404).type('html').send('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>404</title><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#0d0d0d;color:#eee"><div style="text-align:center"><h1 style="font-size:64px;margin:0">404</h1><p style="color:#999">الصفحة غير موجودة</p><a href="/" style="color:#8b7dff">العودة إلى Cosmos</a></div></body></html>');
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    try { res.end(); } catch { /* ignore */ }
    return next(err);
  }
  const status = Number(err.status) || 500;
  const isProd = process.env.NODE_ENV === 'production';
  if (status >= 500) console.error('[error]', req.method, req.originalUrl, err);
  const message = status >= 500 && isProd && !err.expose
    ? 'حدث خطأ غير متوقع. حاول مرة أخرى.'
    : err.message || 'حدث خطأ';
  if (wantsJson(req)) {
    return res.status(status).json({ error: { message, type: err.type || (status >= 500 ? 'server_error' : 'invalid_request_error'), code: err.code } });
  }
  return res.status(status).type('html').send(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>خطأ</title><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#0d0d0d;color:#eee"><div style="text-align:center;max-width:520px;padding:24px"><h1>${status}</h1><p style="color:#bbb;line-height:1.8">${message}</p><a href="/" style="color:#8b7dff">العودة إلى Cosmos</a></div></body></html>`);
}

module.exports = { apiError, openaiError, asyncHandler, wantsJson, notFound, errorHandler };
