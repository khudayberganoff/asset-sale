import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { normalizePhone } from '../src/validate.js';

async function start() {
  const app = createApp(openDb(':memory:'), { adminToken: 'secret' });
  const srv = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${srv.address().port}`;
  const j = (p, o = {}) => fetch(base + p, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers || {}) } });
  return { srv, j };
}
const good = { asset_id: 1, full_name: 'Ali Valiyev', phone: '90 123 45 67', comment: '' };
const auth = { Authorization: 'Bearer secret' };

test('normalizePhone', () => {
  assert.equal(normalizePhone('90 123-45-67'), '+998901234567');
  assert.equal(normalizePhone('+998 (90) 123 45 67'), '+998901234567');
  assert.equal(normalizePhone('12345'), null);
});

test('ariza qabul qilinadi va navbat tartibida turadi', async () => {
  const { srv, j } = await start();
  try {
    assert.ok((await (await j('/api/assets')).json()).length > 0);
    for (const name of ['Birinchi Mijoz', 'Ikkinchi Mijoz']) {
      const r = await j('/api/applications', { method: 'POST', body: JSON.stringify({ ...good, full_name: name }) });
      assert.equal(r.status, 201);
    }
    const list = await (await j('/api/admin/applications', { headers: auth })).json();
    assert.deepEqual(list.map((a) => a.full_name), ['Birinchi Mijoz', 'Ikkinchi Mijoz']);
    assert.equal(list[0].status, 'new');
    assert.equal(list[0].phone, '+998901234567');
  } finally { srv.close(); }
});

test('noto\'g\'ri ma\'lumot rad etiladi', async () => {
  const { srv, j } = await start();
  try {
    const r = await j('/api/applications', { method: 'POST', body: JSON.stringify({ asset_id: 999, full_name: 'A', phone: '1' }) });
    assert.equal(r.status, 400);
    const { errors } = await r.json();
    assert.ok(errors.full_name && errors.phone);
  } finally { srv.close(); }
});

test('admin API parolsiz yopiq, status o\'zgaradi', async () => {
  const { srv, j } = await start();
  try {
    assert.equal((await j('/api/admin/applications')).status, 401);
    await j('/api/applications', { method: 'POST', body: JSON.stringify(good) });
    const p = await j('/api/admin/applications/1', { method: 'PATCH', headers: auth, body: JSON.stringify({ status: 'done' }) });
    assert.equal(p.status, 200);
    const bad = await j('/api/admin/applications/1', { method: 'PATCH', headers: auth, body: JSON.stringify({ status: 'x' }) });
    assert.equal(bad.status, 400);
  } finally { srv.close(); }
});

test('honeypot va tezlik cheklovi', async () => {
  const { srv, j } = await start();
  try {
    await j('/api/applications', { method: 'POST', body: JSON.stringify({ ...good, website: 'spam' }) });
    assert.equal((await (await j('/api/admin/applications', { headers: auth })).json()).length, 0);
    let last;
    for (let i = 0; i < 6; i++) last = await j('/api/applications', { method: 'POST', body: JSON.stringify(good) });
    assert.equal(last.status, 429);
  } finally { srv.close(); }
});
