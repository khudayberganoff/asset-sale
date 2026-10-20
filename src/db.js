import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SEED_ASSETS = [
  ['Chevrolet Gentra 2022', 'Avtomobil', 'Yaxshi holatda, 38 000 km yurgan', 145000000],
  ['Kia K5 2021', 'Avtomobil', 'To\'liq komplektatsiya, bitta egasi', 260000000],
  ['Ofis xonasi, 85 m²', 'Ko\'chmas mulk', 'Toshkent, Chilonzor tumani, 2-qavat', 780000000],
  ['Savdo do\'koni, 120 m²', 'Ko\'chmas mulk', 'Yo\'l bo\'yida, tayyor biznes uchun', 1250000000],
];

// Lead (mijoz) jadvaliga keyin qo'shilgan ustunlar (eski bazalarni yangilash uchun)
const LEAD_COLUMNS = {
  phone2: "TEXT NOT NULL DEFAULT ''",
  address: "TEXT NOT NULL DEFAULT ''",
  passport: "TEXT NOT NULL DEFAULT ''",
  birth_date: "TEXT NOT NULL DEFAULT ''",
  email: "TEXT NOT NULL DEFAULT ''",
  source: "TEXT NOT NULL DEFAULT 'sayt'",
  budget: 'INTEGER',
  responsible: "TEXT NOT NULL DEFAULT ''",
  next_contact_at: "TEXT NOT NULL DEFAULT ''",
  updated_at: "TEXT NOT NULL DEFAULT ''",
};
const OLD_STATUS_TO_STAGE = { in_progress: 'info', done: 'contract', rejected: 'junk' };

export function openDb(path = process.env.DB_PATH || './data/asset-sale.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      price INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    -- "applications" = leadlar. id o'sib boruvchi: kichik id = oldin kelgan (navbat tartibi)
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER REFERENCES assets(id),
      asset_title TEXT NOT NULL DEFAULT '',
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'new',
      crm_synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS lead_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'note',
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notes_lead ON lead_notes(lead_id, id);
  `);

  // --- Migratsiya: eski "status" -> "stage", yangi ustunlar ---
  let cols = db.prepare('PRAGMA table_info(applications)').all().map((c) => c.name);
  if (cols.includes('status') && !cols.includes('stage')) {
    db.exec('DROP INDEX IF EXISTS idx_app_status');
    db.exec('ALTER TABLE applications RENAME COLUMN status TO stage');
    for (const [old, now] of Object.entries(OLD_STATUS_TO_STAGE)) {
      db.prepare('UPDATE applications SET stage = ? WHERE stage = ?').run(now, old);
    }
  }
  for (const [name, def] of Object.entries(LEAD_COLUMNS)) {
    if (!cols.includes(name)) db.exec(`ALTER TABLE applications ADD COLUMN ${name} ${def}`);
  }
  db.exec("UPDATE applications SET updated_at = created_at WHERE updated_at = ''");
  db.exec('CREATE INDEX IF NOT EXISTS idx_app_stage ON applications(stage, id)');

  if (db.prepare('SELECT COUNT(*) c FROM assets').get().c === 0) {
    const ins = db.prepare('INSERT INTO assets (title, category, description, price) VALUES (?,?,?,?)');
    for (const a of SEED_ASSETS) ins.run(...a);
  }
  return db;
}
