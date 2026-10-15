import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { STATUSES, validateApplication } from './validate.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

// Oddiy xotiradagi tezlik cheklovi (IP bo'yicha), spamdan himoya
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const rec = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (rec.length >= max) return res.status(429).json({ error: 'Juda ko\'p so\'rov. Birozdan keyin urinib ko\'ring.' });
    rec.push(now);
    hits.set(req.ip, rec);
    next();
  };
}

function safeEqual(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createApp(db, { adminToken = process.env.ADMIN_TOKEN || '' } = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20kb' }));

  // ---- Ommaviy API ----
  app.get('/api/assets', (_req, res) => {
    res.json(db.prepare('SELECT id, title, category, description, price FROM assets WHERE active = 1 ORDER BY id').all());
  });

  app.post('/api/applications', rateLimit({ windowMs: 10 * 60 * 1000, max: 5 }), (req, res) => {
    if (req.body?.website) return res.status(201).json({ ok: true }); // honeypot: botlar to'ldiradi
    const { ok, errors, value } = validateApplication(req.body);
    if (!ok) return res.status(400).json({ errors });
    let title = value.custom_asset;
    let assetId = null;
    if (value.asset_id) {
      const a = db.prepare('SELECT id, title FROM assets WHERE id = ? AND active = 1').get(value.asset_id);
      if (!a) return res.status(400).json({ errors: { asset_id: 'Aktiv topilmadi' } });
      assetId = a.id;
      title = a.title;
    }
    const r = db.prepare(
      'INSERT INTO applications (asset_id, asset_title, full_name, phone, comment) VALUES (?,?,?,?,?)'
    ).run(assetId, title, value.full_name, value.phone, value.comment);
    res.status(201).json({ ok: true, id: Number(r.lastInsertRowid) });
  });

  // ---- Admin API (Bearer ADMIN_TOKEN) ----
  const admin = express.Router();
  admin.use((req, res, next) => {
    const t = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!adminToken || !safeEqual(t, adminToken)) return res.status(401).json({ error: 'Ruxsat yo\'q' });
    next();
  });
  admin.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));

  // Navbat: eng eski ariza birinchi. Faol (new/in_progress) arizalar tepada.
  admin.get('/applications', (req, res) => {
    const status = String(req.query.status || '');
    const rows = STATUSES.includes(status)
      ? db.prepare('SELECT * FROM applications WHERE status = ? ORDER BY id').all(status)
      : db.prepare(`SELECT * FROM applications
                    ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, id`).all();
    res.json(rows);
  });

  admin.patch('/applications/:id', (req, res) => {
    if (!STATUSES.includes(req.body?.status)) return res.status(400).json({ error: 'Status noto\'g\'ri' });
    const r = db.prepare('UPDATE applications SET status = ? WHERE id = ?').run(req.body.status, Number(req.params.id));
    if (!r.changes) return res.status(404).json({ error: 'Topilmadi' });
    res.json({ ok: true });
  });

  admin.get('/assets', (_req, res) => res.json(db.prepare('SELECT * FROM assets ORDER BY id').all()));

  admin.post('/assets', (req, res) => {
    const title = String(req.body?.title ?? '').trim();
    if (!title) return res.status(400).json({ error: 'Nomi kerak' });
    const price = req.body?.price === '' || req.body?.price == null ? null : Math.round(Number(req.body.price));
    if (price !== null && !(price >= 0)) return res.status(400).json({ error: 'Narx noto\'g\'ri' });
    const r = db.prepare('INSERT INTO assets (title, category, description, price) VALUES (?,?,?,?)').run(
      title.slice(0, 200), String(req.body?.category ?? '').trim().slice(0, 60),
      String(req.body?.description ?? '').trim().slice(0, 500), price);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });

  admin.patch('/assets/:id', (req, res) => {
    const r = db.prepare('UPDATE assets SET active = ? WHERE id = ?').run(req.body?.active ? 1 : 0, Number(req.params.id));
    if (!r.changes) return res.status(404).json({ error: 'Topilmadi' });
    res.json({ ok: true });
  });

  app.use('/api/admin', admin);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Topilmadi' }));

  app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
  return app;
}
