import { STAGE_KEYS } from './stages.js';

// O'zbekiston raqami: +998XXXXXXXXX (9 raqam), turli yozilishlarni qabul qiladi
export function normalizePhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 9) d = '998' + d;
  return /^998\d{9}$/.test(d) ? '+' + d : null;
}

const clean = (v, max) => String(v ?? '').trim().replace(/[ \t]+/g, ' ').slice(0, max);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

// Lead maydonlari. Har biri: tozalaydi va xato bo'lsa matn qaytaradi.
const FIELDS = {
  full_name: (v) => {
    const s = clean(v, 120);
    return s.length >= 3 ? { v: s } : { err: 'F.I.Sh. kiriting (3-120 belgi)' };
  },
  phone: (v) => {
    const p = normalizePhone(v);
    return p ? { v: p } : { err: 'Telefon raqami noto\'g\'ri (masalan +998 90 123 45 67)' };
  },
  phone2: (v) => {
    if (!String(v ?? '').trim()) return { v: '' };
    const p = normalizePhone(v);
    return p ? { v: p } : { err: 'Qo\'shimcha telefon noto\'g\'ri' };
  },
  address: (v) => ({ v: clean(v, 300) }),
  passport: (v) => ({ v: clean(v, 30).toUpperCase() }),
  birth_date: (v) => {
    const s = clean(v, 10);
    return !s || isDate(s) ? { v: s } : { err: 'Tug\'ilgan sana noto\'g\'ri' };
  },
  email: (v) => {
    const s = clean(v, 120);
    return !s || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? { v: s } : { err: 'Email noto\'g\'ri' };
  },
  source: (v) => ({ v: clean(v, 40) || 'qo\'lda' }),
  budget: (v) => {
    if (v === '' || v == null) return { v: null };
    const n = Math.round(Number(v));
    return n >= 0 && n < 1e15 ? { v: n } : { err: 'Byudjet noto\'g\'ri' };
  },
  asset_title: (v) => ({ v: clean(v, 200) }),
  comment: (v) => {
    const s = String(v ?? '').trim();
    return s.length <= 1000 ? { v: s } : { err: 'Izoh 1000 belgidan oshmasin' };
  },
  responsible: (v) => ({ v: clean(v, 80) }),
  next_contact_at: (v) => {
    const s = clean(v, 10);
    return !s || isDate(s) ? { v: s } : { err: 'Keyingi aloqa sanasi noto\'g\'ri' };
  },
  stage: (v) => (STAGE_KEYS.includes(v) ? { v } : { err: 'Bosqich noto\'g\'ri' }),
};
export const LEAD_FIELDS = Object.keys(FIELDS);

// partial=true: faqat berilgan maydonlar tekshiriladi (PATCH). Aks holda full_name va phone majburiy.
export function validateLead(body, { partial = false, allow = LEAD_FIELDS } = {}) {
  const errors = {};
  const value = {};
  for (const k of allow) {
    if (partial ? body?.[k] === undefined : (body?.[k] === undefined && k !== 'full_name' && k !== 'phone')) continue;
    const r = FIELDS[k](body?.[k]);
    if (r.err) errors[k] = r.err; else value[k] = r.v;
  }
  return { ok: Object.keys(errors).length === 0, errors, value };
}

// Ommaviy sayt formasi: faqat mijoz o'zi to'ldiradigan maydonlar
export function validateApplication(body) {
  const { errors, value } = validateLead(body, { allow: ['full_name', 'phone', 'address', 'comment'] });
  const asset_id = Number.isInteger(Number(body?.asset_id)) && Number(body?.asset_id) > 0 ? Number(body.asset_id) : null;
  const custom_asset = clean(body?.custom_asset, 200);
  if (!asset_id && !custom_asset) errors.asset_id = 'Aktivni tanlang yoki nomini yozing';
  return { ok: Object.keys(errors).length === 0, errors, value: { ...value, asset_id, custom_asset } };
}
