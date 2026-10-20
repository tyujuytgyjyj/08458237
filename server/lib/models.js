'use strict';

/**
 * سجلّ نماذج Cosmos العامة.
 * كل ما يظهر للمتصفح هنا يستخدم أسماء المنتج فقط، دون أسماء مزوّدين
 * أو أسماء نماذج خارجية أو عناوين خدمات.
 */

const config = require('../config');
const photon = require('./photon');
const gemini = require('./gemini');

const PRODUCTS = [
  {
    id: 'cosmos-blazar-3',
    provider: 'gemini',
    label: 'Cosmos Blazar 3',
    description: 'الأقوى — للمهام الطويلة والفهم العميق والكتابة الاحترافية',
    tag: 'الرائد',
    capabilities: { vision: true, streaming: true, images: true },
  },
  {
    id: 'cosmos-photon-3',
    provider: 'photon',
    label: 'Cosmos Photon 3',
    description: 'خفيف وسريع جدًا — للمهام اليومية والمحادثات القصيرة',
    tag: 'سريع',
    capabilities: { vision: true, streaming: true, images: false },
  },
];

const ALIASES = {
  blazar: 'cosmos-blazar-3',
  'cosmos-blazar': 'cosmos-blazar-3',
  photon: 'cosmos-photon-3',
  'cosmos-photon': 'cosmos-photon-3',
};

function find(id) {
  const key = String(id || '').trim().toLowerCase();
  const canonical = ALIASES[key] || key;
  return PRODUCTS.find((p) => p.id === canonical) || null;
}

/**
 * يحدد وجهة الطلب. لا يوجد أي مسار مشترك بين المنتجين:
 * Blazar 3 → خدمة Blazar، Photon 3 → خدمة Photon المحلية.
 */
function resolve(requested) {
  const wanted = String(requested || '').trim();
  if (!wanted) return PRODUCTS[0];
  const product = find(wanted);
  if (product) return product;

  /* أسماء النماذج الداخلية القديمة تُقبل للتوافق مع عملاء API فقط،
     لكنها لا تُعرض في الواجهة ولا تُغيّر وجهة الطلب إلا داخل مزوّدها. */
  if (/^deepseek-/i.test(wanted)) return PRODUCTS[1];
  if (/^(gemini-|gemma-)/i.test(wanted)) return PRODUCTS[0];
  return PRODUCTS[0];
}

function availability() {
  return {
    'cosmos-blazar-3': !gemini.isDemo(),
    'cosmos-photon-3': photon.isAvailableCached(),
  };
}

function list() {
  const ready = availability();
  return PRODUCTS.map((p) => ({
    id: p.id,
    object: 'model',
    label: p.label,
    description: p.description,
    tag: p.tag,
    capabilities: p.capabilities,
    available: Boolean(ready[p.id]),
  }));
}

/** يحدّث حالة التوفر في الخلفية دون تعطيل الطلب الحالي. */
function refreshAvailability() {
  photon.health().catch(() => {});
}

/** يضمن وجود قراءة حديثة لحالة Photon قبل إرجاع قائمة النماذج. */
async function primeAvailability() {
  await photon.health();
}

module.exports = { PRODUCTS, resolve, find, list, availability, refreshAvailability, primeAvailability };
