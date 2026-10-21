import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { normalizePhone } from '../src/validate.js';

async function start(db = openDb(':memory:')) {
  const app = createApp(db, { adminToken: 'secret' });
  const srv = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${srv.address().port}`;
  const j = (p, o = {}) => fetch(base + p, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers || {}) } });
  return { srv, j };
}
const auth = { Authorization: 'Bearer secret' };
const post = (j, p, body) => j(p, { method: 'POST', headers: auth, body: JSON.stringify(body) });
const patch = (j, p, body) => j(p, { method: 'PATCH', headers: auth, body: JSON.stringify(body) });

test('normalizePhone', () => {
  assert.equal(normalizePhone('90 123-45-67'), '+998901234567');
  assert.equal(normalizePhone('+998 (90) 123 45 67'), '+998901234567');
  assert.equal(normalizePhone('12345'), null);
});

test('sayt bosh sahifasi CRM ga yo\'naltiradi, ommaviy API yo\'q', async () => {
  const { srv, j } = await start();
  try {
    const r = await fetch(srv.address() && `http://127.0.0.1:${srv.address().port}/`, { redirect: 'manual' });
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), '/admin/');
    assert.equal((await j('/api/applications', { method: 'POST', body: '{}' })).status, 404);
    assert.equal((await j('/api/assets')).status, 404);
  } finally { srv.close(); }
});

test('leadlar navbat tartibida turadi, yangisi "Yangi lead" bosqichida', async () => {
  const { srv, j } = await start();
  try {
    for (const name of ['Birinchi Mijoz', 'Ikkinchi Mijoz']) {
      const r = await post(j, '/api/admin/leads', { full_name: name, phone: '90 123 45 67', address: 'Toshkent' });
      assert.equal(r.status, 201);
    }
    const list = await (await j('/api/admin/leads', { headers: auth })).json();
    assert.deepEqual(list.map((a) => a.full_name), ['Birinchi Mijoz', 'Ikkinchi Mijoz']);
    assert.equal(list[0].stage, 'new');
    assert.equal(list[0].address, 'Toshkent');
    assert.equal(list[0].phone, '+998901234567');
  } finally { srv.close(); }
});

test('CRM API parolsiz yopiq; bosqichlar ro\'yxati 7 ta', async () => {
  const { srv, j } = await start();
  try {
    assert.equal((await j('/api/admin/leads')).status, 401);
    const st = await (await j('/api/admin/stages', { headers: auth })).json();
    assert.deepEqual(st.map((s) => s.key), ['new', 'info', 'callback', 'meeting', 'visited', 'contract', 'junk']);
  } finally { srv.close(); }
});

test('lead qo\'lda qo\'shiladi, to\'liq ma\'lumot saqlanadi, bosqich o\'zgaradi va tarixga yoziladi', async () => {
  const { srv, j } = await start();
  try {
    const r = await post(j, '/api/admin/leads', {
      full_name: 'Karimov Sardor', phone: '+998 91 111 22 33', phone2: '935556677', address: 'Samarqand, Registon 5',
      passport: 'aa1234567', birth_date: '1990-05-17', email: 's@x.uz', budget: 150000000, asset_title: 'Kia K5', responsible: 'Dilnoza',
    });
    assert.equal(r.status, 201);
    const { id } = await r.json();
    assert.equal((await patch(j, `/api/admin/leads/${id}`, { stage: 'meeting', next_contact_at: '2026-11-01' })).status, 200);
    assert.equal((await patch(j, `/api/admin/leads/${id}`, { stage: 'nope' })).status, 400);
    assert.equal((await post(j, `/api/admin/leads/${id}/notes`, { text: 'Ertaga 10:00 ga keladi' })).status, 201);
    const lead = await (await j(`/api/admin/leads/${id}`, { headers: auth })).json();
    assert.equal(lead.stage, 'meeting');
    assert.equal(lead.phone2, '+998935556677');
    assert.equal(lead.passport, 'AA1234567');
    assert.equal(lead.budget, 150000000);
    assert.equal(lead.source, 'qo\'lda');
    assert.ok(lead.notes.some((n) => n.text === 'Bosqich: Yangi lead → Uchrashuv belgilandi'));
    assert.equal(lead.notes[0].text, 'Ertaga 10:00 ga keladi');
    const found = await (await j('/api/admin/leads?q=111 22 33', { headers: auth })).json();
    assert.equal(found.length, 1);
    assert.equal((await (await j('/api/admin/leads?q=yo\'q-bunaqa', { headers: auth })).json()).length, 0);
    assert.equal((await post(j, '/api/admin/leads', { full_name: 'X', phone: '1' })).status, 400);
  } finally { srv.close(); }
});

test('eski baza (status) yangi tuzilmaga o\'tkaziladi', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'as-')), 'old.db');
  const old = new DatabaseSync(path);
  old.exec(`CREATE TABLE assets (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', price INTEGER, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE applications (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_id INTEGER, asset_title TEXT NOT NULL, full_name TEXT NOT NULL, phone TEXT NOT NULL, comment TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new', crm_synced_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX idx_app_status ON applications(status, id);
    INSERT INTO applications (asset_title, full_name, phone, status) VALUES ('A','Bir','+998901112233','new'),('B','Ikki','+998901112234','in_progress'),('C','Uch','+998901112235','done'),('D','Tort','+998901112236','rejected');`);
  old.close();
  const db = openDb(path);
  assert.deepEqual(db.prepare('SELECT stage FROM applications ORDER BY id').all().map((r) => r.stage), ['new', 'info', 'contract', 'junk']);
  assert.equal(db.prepare('SELECT source FROM applications WHERE id = 1').get().source, 'sayt');
  assert.equal(db.prepare('SELECT COUNT(*) c FROM assets').get().c, 0);
  openDb(path); // qayta ochish xatosiz
});

test('eski bazada ham yangi lead qo\'shiladi', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'as-')), 'old2.db');
  const old = new DatabaseSync(path);
  old.exec(`CREATE TABLE assets (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL);
    CREATE TABLE applications (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_id INTEGER REFERENCES assets(id), asset_title TEXT NOT NULL, full_name TEXT NOT NULL, phone TEXT NOT NULL, comment TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new', crm_synced_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));`);
  old.close();
  const { srv, j } = await start(openDb(path));
  try {
    assert.equal((await post(j, '/api/admin/leads', { full_name: 'Eski Baza', phone: '901234567' })).status, 201);
  } finally { srv.close(); }
});
