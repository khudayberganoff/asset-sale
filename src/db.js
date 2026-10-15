import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SEED_ASSETS = [
  ['Chevrolet Gentra 2022', 'Avtomobil', 'Yaxshi holatda, 38 000 km yurgan', 145000000],
  ['Kia K5 2021', 'Avtomobil', 'To\'liq komplektatsiya, bitta egasi', 260000000],
  ['Ofis xonasi, 85 m²', 'Ko\'chmas mulk', 'Toshkent, Chilonzor tumani, 2-qavat', 780000000],
  ['Savdo do\'koni, 120 m²', 'Ko\'chmas mulk', 'Yo\'l bo\'yida, tayyor biznes uchun', 1250000000],
];

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
    -- id o'sib boruvchi: kichik id = oldin kelgan ariza (navbat/stek tartibi)
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER REFERENCES assets(id),
      asset_title TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      crm_synced_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status, id);
  `);
  if (db.prepare('SELECT COUNT(*) c FROM assets').get().c === 0) {
    const ins = db.prepare('INSERT INTO assets (title, category, description, price) VALUES (?,?,?,?)');
    for (const a of SEED_ASSETS) ins.run(...a);
  }
  return db;
}
