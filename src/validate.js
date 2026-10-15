export const STATUSES = ['new', 'in_progress', 'done', 'rejected'];

// O'zbekiston raqami: +998XXXXXXXXX (9 raqam), turli yozilishlarni qabul qiladi
export function normalizePhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 9) d = '998' + d;
  return /^998\d{9}$/.test(d) ? '+' + d : null;
}

export function validateApplication(body) {
  const errors = {};
  const full_name = String(body?.full_name ?? '').trim().replace(/\s+/g, ' ');
  if (full_name.length < 3 || full_name.length > 120) errors.full_name = 'F.I.Sh. kiriting (3-120 belgi)';
  const phone = normalizePhone(body?.phone);
  if (!phone) errors.phone = 'Telefon raqami noto\'g\'ri (masalan +998 90 123 45 67)';
  const comment = String(body?.comment ?? '').trim();
  if (comment.length > 1000) errors.comment = 'Izoh 1000 belgidan oshmasin';
  const asset_id = Number.isInteger(Number(body?.asset_id)) ? Number(body.asset_id) : null;
  const custom_asset = String(body?.custom_asset ?? '').trim().slice(0, 200);
  if (!asset_id && !custom_asset) errors.asset_id = 'Aktivni tanlang yoki nomini yozing';
  return { ok: Object.keys(errors).length === 0, errors, value: { full_name, phone, comment, asset_id, custom_asset } };
}
