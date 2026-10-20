<div align="center">

# Cosmos

**مساحة واحدة لكل أفكارك — دردشة ذكاء اصطناعي عربية كاملة.**

Node.js + HTML/CSS/JS فانيلا · Gemini · بث SSE · تسجيل دخول · Stripe · لوحة إدارة

</div>

---

## ما هذا؟

Cosmos تطبيق دردشة كامل باللغة العربية (RTL) بواجهة تشبه ChatGPT، يعمل على خادم Node.js واحد بدون أي إطار عمل أمامي.
الواجهة مبنية بـ HTML/CSS/JS فانيلا، والخادم Express يقدّم الواجهة وواجهة برمجية متوافقة مع OpenAI، ويتصل بـ Gemini من جهة الخادم (المفتاح لا يظهر للمتصفح أبدًا).

- الواجهة: `http://localhost:4000`
- لوحة الإدارة: `http://localhost:4000/admin`
- فحص الصحة: `http://localhost:4000/api/health`

## المزايا

| المجال | التفاصيل |
| --- | --- |
| المحادثة | بث مباشر (SSE)، إيقاف التوليد، إعادة التوليد، تعديل الرسائل، نسخ، تنزيل، تقييم الردود |
| المرفقات | صور (تُضغط في المتصفح)، PDF، ملفات نصية وكود — تُرسل إلى Gemini كأجزاء أصلية |
| النماذج | Blazar 3 (الأقوى) وPhoton 3 (الأسرع)، مع تحويل تلقائي للنموذج البديل عند فشل النموذج الأساسي |
| المحادثات | قائمة جانبية، بحث فوري، تثبيت، إعادة تسمية، حذف، مزامنة مع الخادم بعد الدخول |
| المساحة | ملاحظات، مهام مجدولة مع إشعارات، مكتبة أوامر، وسجل نشاط |
| الحساب | دخول بالبريد عبر رمز 6 أرقام، ودخول Google OAuth، وتصدير/حذف البيانات |
| الاشتراك | خطط Premium وPro وStripe Checkout + بوابة الفوترة + Webhook |
| استوديو الصور | توليد صور عبر Gemini، مع صورة توضيحية محلية عند تعذّر الاتصال |
| لوحة الإدارة | إحصاءات، مستخدمون، خطط، إيقاف/حظر، سجل أمان، تشخيص، تصدير CSV |
| PWA | Manifest وأيقونات وService Worker وصفحة عمل دون اتصال |
| المتانة | حماية CSRF، تحديد معدل، حماية Origin، Anti-CLI، كابتشا اختيارية، حدود يومية للرسائل |

## التشغيل السريع

المتطلبات: **Node.js 20.19+** (مُختبر على 22).

```bash
npm install
npm start
```

ثم افتح `http://localhost:4000`.

الخادم يقرأ الإعدادات من `.env` الموجود في جذر المشروع. إذا نسخت المشروع دون `.env`:

```bash
cp .env.example .env
# عدّل القيم ثم شغّل
npm start
```

للتطوير مع إعادة التشغيل التلقائي:

```bash
npm run dev
```

## الإعدادات الأساسية

| المتغير | الوظيفة |
| --- | --- |
| `PORT` | منفذ الخادم (افتراضي 4000) |
| `GEMINI_API_KEY` | مفتاح Google AI Studio (مفاتيح `AQ.` الجديدة مدعومة على المسار الأصلي) |
| `GEMINI_MODEL` | النموذج الأساسي (مثال: `gemma-4-31b-it` أو `gemini-2.5-flash`) |
| `GEMINI_FALLBACK_MODEL` | نموذج بديل يُجرّب تلقائيًا عند 404/عدم دعم النموذج |
| `GEMINI_IMAGE_MODEL` | نموذج توليد الصور (مثال: `gemini-2.5-flash-image`) |
| `SESSION_SECRET` | توقيع كوكيز الجلسات (استخدم قيمة عشوائية طويلة) |
| `RESTRICTION_ADMIN_SECRET` | مفتاح الدخول إلى `/admin` (يُرسل كترويسة `x-admin-secret`) |
| `FREE_DAILY_MESSAGES` / `GUEST_DAILY_MESSAGES` | الحد اليومي للرسائل |
| `EMAIL_*` | SMTP لإرسال رموز الدخول (Gmail: استخدم App Password) |
| `GOOGLE_OAUTH_*` | تسجيل الدخول بجوجل |
| `STRIPE_*` | الاشتراكات |
| `DB_*` / `REDIS_URL` | اختياريان؛ يوجد fallback إلى JSON وذاكرة داخلية |

> ملف `.env` مستثنى من Git عبر `.gitignore`. لا تشاركه ولا ترفعه.

## الدخول والحسابات

### البريد الإلكتروني (بدون كلمة مرور)

1. «الحساب» ← أدخل بريدك ← إرسال رمز.
2. يُرسل رمز من 6 أرقام عبر SMTP.
3. عند تعذّر SMTP ووجود `DEMO_MODE=true` يظهر الرمز داخل النافذة تلقائيًا (وضع تجريبي).
4. بعد التحقق تُنشأ الجلسة، وتُنقل محادثاتك المحلية إلى حسابك.

لإيقاف إظهار الرمز في الإنتاج: `DEMO_MODE=false` مع SMTP يعمل.

### Google

- أنشئ OAuth Client (Web) وأضف:
  `https://<نطاقك>/auth/google/callback`
- ضع `GOOGLE_OAUTH_CLIENT_ID` و`GOOGLE_OAUTH_CLIENT_SECRET`.
- اترك `GOOGLE_OAUTH_REDIRECT_URI` فارغًا ليُبنى تلقائيًا من نطاق الطلب، أو ثبّته يدويًا.

## Gemini

يستخدم الخادم المسار الأصلي:

```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent
```

- مفاتيح `AQ.` الجديدة تعمل مع `?key=` على المسار الأصلي (وليست على مسار OpenAI الخاص بجوجل).
- عند فشل الوصول إلى الشبكة، يعيد الخادم **ردًا توضيحيًا عربيًا** إذا كان `DEMO_FALLBACK=true` بدل إظهار خطأ صامت.
- إذا لم يكن النموذج متاحًا (404) يُجرّب `GEMINI_FALLBACK_MODEL` ثم يعيد الخطأ الأصلي.
- الصور: `POST /api/images` يستخدم `GEMINI_IMAGE_MODEL`، ومع تعذّر الاتصال يعيد صورة SVG محلية موسومة كتجريبية.

## لوحة الإدارة

- الرابط: `/admin`
- المفتاح: قيمة `RESTRICTION_ADMIN_SECRET` من `.env`.
- كل طلبات الإدارة تتطلب ترويسة `x-admin-secret`.
- تشمل: إحصاءات اليوم، المستخدمون والخطط، إيقاف/حذف، حظر IP/مستخدم، سجل الأحداث، سجل الأمان (Anti-CLI)، تشخيص Gemini والبريد، تصدير CSV.

مثال:

```bash
curl -s http://localhost:4000/api/admin/overview \
  -H "x-admin-secret: $RESTRICTION_ADMIN_SECRET"
```

## Stripe

- ضع `STRIPE_SECRET_KEY` و`STRIPE_PUBLISHABLE_KEY` (وضع الاختبار يكفي للتجربة).
- إن لم تضبط `STRIPE_PREMIUM_PRICE_ID`/`STRIPE_PRO_PRICE_ID` سينشئ الخادم السعر تلقائيًا (`price_data`) بقيمة الخطة في `server/config.js`.
- نجاح الدفع يعيد المستخدم إلى `/?checkout=success&session_id=...`، ويستدعي الخادم Stripe للتحقق وتفعيل الخطة مباشرة (`POST /api/billing/sync`).
- Webhook (موصى به): `POST https://<نطاقك>/api/billing/webhook` واستمع لـ:
  `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- بوابة الفوترة: `POST /api/billing/portal` (تتطلب `stripeCustomerId`).

## واجهة API

### متوافقة مع OpenAI

```bash
curl -N http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COSMOS_API_KEY" \
  -d '{"model":"cosmos-blazar-3","stream":true,
       "messages":[{"role":"user","content":"مرحبًا، عرّفني بنفسك"}]}'
```

- تدعم `stream: true/false` وتعيد صيغة `chat.completion.chunk` ثم `data: [DONE]`.
- تعمل أيضًا بدون كوكيز (مثل ملف HTML القديم)، مع CORS مفتوح لمسار `/v1`.
- `GET /v1/models` و`GET /api/models`.
- `POST /reset-session?agent=all` لإنهاء الجلسة المنطقية.

### مسارات التطبيق

| المسار | الوصف |
| --- | --- |
| `GET /api/me` | المستخدم، الحدود، الميزات، رمز CSRF |
| `PATCH /api/me` | تعديل الاسم/التفضيلات |
| `GET/PUT/DELETE /api/chats[/:id]` | مزامنة المحادثات |
| `GET /api/usage` | الاستهلاك اليومي |
| `POST /api/images` | توليد صورة |
| `POST /api/feedback` | ملاحظة |
| `GET /api/account/export` | تصدير البيانات |
| `POST /api/account/delete` | حذف الحساب (`{"confirm":"DELETE"}`) |
| `GET /api/status` | حالة عامة آمنة (بلا أسرار) |
| `GET /api/health` | فحص صحة |
| `GET /api/admin/*` | لوحة الإدارة |

> كل طلبات المتصفح غير الآمنة تحتاج ترويسة `x-csrf-token` المطابقة للكوكي. عملاء API يستخدمون Bearer key أو يرسلون دون كوكيز.

## التخزين

- الافتراضي: `data/cosmos-db.json` (كتابة ذرية + debounce).
- PostgreSQL: اضبط `DB_*` لاستخدام جدول `cosmos_docs` (مناسب لـ Render مع قرص دائم أو قاعدة بيانات).
- Redis اختياري للحدود والجلسات، مع fallback داخلي.

## الاختبارات والفحص

```bash
npm test          # 13 اختبار تكامل (خادم مؤقت، تخزين مؤقت، مزوّد mock)
npm run check     # فحص صياغة JS + تطابق معرّفات HTML + الأصول
npm run mock:gemini   # خادم OpenAI-compatible محلي على 9655 للتطوير بلا إنترنت
```

فحوصات واجهة اختيارية عبر jsdom (تحتاج خادمًا يعمل على 4000):

```bash
node tools/ui-smoke.js
node tools/ui-flows.js
```

## النشر على Render

1. اربط المستودع، Build: `npm install`، Start: `npm start`.
2. Health Check Path: `/api/health`.
3. أضف متغيرات `.env` في لوحة Render.
4. اضبط `PUBLIC_URL` و`MAIN_URL` على نطاقك.
5. أضف عنوان OAuth: `https://<نطاقك>/auth/google/callback`.
6. أضف Webhook: `https://<نطاقك>/api/billing/webhook`.
7. للتخزين الدائم: فعّل Postgres واضبط `DB_*`، أو اربط Disk على `data/`.

## البنية

```
server/
  index.js            تجميع Express، الصفحات، الأخطاء، التشغيل
  config.js           قراءة .env والتحقق من القيم
  lib/                store, sessions, security, gemini, auth, billing, email...
  routes/             chat, chats, api, auth, billing, admin, public
public/
  index.html          واجهة الدردشة
  admin.html          لوحة الإدارة
  assets/             app.js/app.css/theme-init.js + admin.js/admin.css
  sw.js, manifest.webmanifest, offline.html, icons/
tests/api.test.js     اختبارات تكامل
tools/                mock-gemini.js + فحوصات jsdom
data/                 قاعدة البيانات المحلية (مستثناة من Git)
```

## استكشاف الأخطاء

| العرض | السبب والحل |
| --- | --- |
| «تعذّر الوصول إلى Gemini من شبكة الخادم» | الخادم لا يصل إلى `generativelanguage.googleapis.com`. تحقق من الشبكة/الجدار الناري، أو اترك `DEMO_FALLBACK=true` للعمل تجريبيًا. |
| رمز الدخول لا يصل | SMTP محجوب أو بياناته خاطئة. استخدم App Password، أو `DEMO_MODE=true` للتجربة. |
| 401 في `/admin` | المفتاح غير مطابق لـ `RESTRICTION_ADMIN_SECRET`. |
| 403 `csrf` | أعد تحميل الصفحة (يجدد الكوكي والرمز)، أو أرسل `x-csrf-token` مع الكوكيز. |
| 403 `cli_blocked` | وصول من أداة سطر أوامر؛ استخدم `Authorization: Bearer $COSMOS_API_KEY` أو `ANTI_CLI_DISABLE=true`. |
| Redis/Postgres في السجلات | غير متاحين؛ يعمل التطبيق تلقائيًا بملفات JSON وذاكرة داخلية. |
| تغييرات لا تظهر | امسح كاش المتصفح أو حدّث نسخة Service Worker (غيّر `VERSION` في `sw.js`). |

---

صُنع بـ Node.js وHTML فانيلا — بلا React ولا bundler.
