import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { STAGES, stageTitle } from './stages.js';
import { LEAD_FIELDS, validateLead } from './validate.js';

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

  const addNote = (leadId, text, kind = 'system') =>
    db.prepare('INSERT INTO lead_notes (lead_id, kind, text) VALUES (?,?,?)').run(leadId, kind, text);

  // ---- CRM API (Bearer ADMIN_TOKEN) ----
  const crm = express.Router();
  crm.use((req, res, next) => {
    const t = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!adminToken || !safeEqual(t, adminToken)) return res.status(401).json({ error: 'Ruxsat yo\'q' });
    next();
  });
  crm.use(rateLimit({ windowMs: 60 * 1000, max: 240 }));

  crm.get('/stages', (_req, res) => res.json(STAGES));

  // Barcha leadlar; har bosqichda eng eski birinchi (navbat tartibi). ?q= — ism/telefon/aktiv/manzil bo'yicha qidiruv
  crm.get('/leads', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    let rows = db.prepare('SELECT * FROM applications ORDER BY id').all();
    if (q) {
      const digits = q.replace(/\D/g, '');
      rows = rows.filter((l) =>
        [l.full_name, l.asset_title, l.address, l.passport, l.responsible].some((s) => s.toLowerCase().includes(q)) ||
        (digits.length >= 3 && (l.phone + l.phone2).replace(/\D/g, '').includes(digits)));
    }
    res.json(rows);
  });

  crm.post('/leads', (req, res) => {
    const { ok, errors, value } = validateLead(req.body);
    if (!ok) return res.status(400).json({ errors });
    const data = { source: 'qo\'lda', stage: 'new', asset_title: '', ...value }; // asset_title: eski bazalarda NOT NULL
    const keys = Object.keys(data);
    const r = db.prepare(`INSERT INTO applications (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(data));
    const id = Number(r.lastInsertRowid);
    addNote(id, 'Lead qo\'lda qo\'shildi');
    res.status(201).json({ id });
  });

  crm.get('/leads/:id', (req, res) => {
    const lead = db.prepare('SELECT * FROM applications WHERE id = ?').get(Number(req.params.id));
    if (!lead) return res.status(404).json({ error: 'Topilmadi' });
    lead.notes = db.prepare('SELECT id, kind, text, created_at FROM lead_notes WHERE lead_id = ? ORDER BY id DESC').all(lead.id);
    res.json(lead);
  });

  crm.patch('/leads/:id', (req, res) => {
    const id = Number(req.params.id);
    const lead = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    if (!lead) return res.status(404).json({ error: 'Topilmadi' });
    const { ok, errors, value } = validateLead(req.body, { partial: true });
    if (!ok) return res.status(400).json({ errors });
    const keys = LEAD_FIELDS.filter((k) => k in value && value[k] !== lead[k]);
    if (keys.length) {
      db.prepare(`UPDATE applications SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
        .run(...keys.map((k) => value[k]), id);
      if (keys.includes('stage')) addNote(id, `Bosqich: ${stageTitle(lead.stage)} → ${stageTitle(value.stage)}`);
    }
    res.json({ ok: true });
  });

  crm.post('/leads/:id/notes', (req, res) => {
    const id = Number(req.params.id);
    const text = String(req.body?.text ?? '').trim();
    if (!text || text.length > 1000) return res.status(400).json({ error: 'Izoh matni kerak (1000 belgigacha)' });
    if (!db.prepare('SELECT 1 FROM applications WHERE id = ?').get(id)) return res.status(404).json({ error: 'Topilmadi' });
    addNote(id, text, 'note');
    res.status(201).json({ ok: true });
  });

  app.use('/api/admin', crm);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Topilmadi' }));

  app.get('/', (_req, res) => res.redirect('/admin/'));
  app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
  return app;
}
