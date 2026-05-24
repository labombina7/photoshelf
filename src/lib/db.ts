import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { PHOTOS_PATH } from './config';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'photoshelf.db');

let _db: Database.Database | null = null;

export function getSidebarProjects(db: Database.Database): { id: number; title: string }[] {
  return db.prepare('SELECT id, title FROM projects ORDER BY created_at DESC').all() as { id: number; title: string }[];
}

export function getDb(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      path        TEXT NOT NULL UNIQUE,
      filename    TEXT NOT NULL,
      year        INTEGER NOT NULL,
      event       TEXT NOT NULL,
      size_bytes  INTEGER,
      width       INTEGER,
      height      INTEGER,
      taken_at    TEXT,
      camera      TEXT,
      exposure    TEXT,
      gps_lat     REAL,
      gps_lon     REAL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      scanned_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL UNIQUE COLLATE NOCASE
    );

    CREATE TABLE IF NOT EXISTS photo_tags (
      photo_id  INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
      tag_id    INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      source    TEXT NOT NULL CHECK(source IN ('manual', 'ai')),
      PRIMARY KEY (photo_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS themes (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL UNIQUE COLLATE NOCASE,
      color TEXT NOT NULL DEFAULT '#888888'
    );

    CREATE TABLE IF NOT EXISTS photo_themes (
      photo_id  INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
      theme_id  INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
      PRIMARY KEY (photo_id, theme_id)
    );

    CREATE INDEX IF NOT EXISTS idx_photos_year    ON photos(year);
    CREATE INDEX IF NOT EXISTS idx_photos_event   ON photos(year, event);
    CREATE INDEX IF NOT EXISTS idx_photos_fav     ON photos(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_photo_tags     ON photo_tags(photo_id);
    CREATE INDEX IF NOT EXISTS idx_photo_tags_tag ON photo_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_tags_name      ON tags(name);
    CREATE INDEX IF NOT EXISTS idx_photo_themes_p ON photo_themes(photo_id);
    CREATE INDEX IF NOT EXISTS idx_photo_themes_t ON photo_themes(theme_id);

    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      statement   TEXT NOT NULL DEFAULT '',
      scope_type  TEXT NOT NULL CHECK(scope_type IN ('year','event','theme','all')),
      scope_value TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_photos (
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      photo_id    INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
      position    INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (project_id, photo_id)
    );

    CREATE INDEX IF NOT EXISTS idx_project_photos_p ON project_photos(project_id);

    CREATE INDEX IF NOT EXISTS idx_photos_gps ON photos(gps_lat, gps_lon);
  `);

  // ── EPIC-001 migration: catalogs table + catalog_id column ────────────────
  migrateEpic001(db);
}

function migrateEpic001(db: Database.Database) {
  // 1. Create catalogs table (idempotent)
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalogs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      path       TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // 2. Upsert default catalog (id=1) — always keep its path in sync with PHOTOS_PATH.
  //    ON CONFLICT updates the path so renaming the host mount doesn't orphan the catalog.
  //    The user-defined name is preserved.
  db.prepare(`
    INSERT INTO catalogs (id, name, path) VALUES (1, 'Principal', ?)
    ON CONFLICT(id) DO UPDATE SET path = excluded.path
  `).run(PHOTOS_PATH);

  // 3. Add catalog_id column to photos (idempotent via try/catch — SQLite has no IF NOT EXISTS for columns).
  //    NOTE: no REFERENCES clause here — SQLite rejects ALTER TABLE ADD COLUMN with both a
  //    FK reference AND a non-NULL DEFAULT when foreign_keys = ON.  Referential integrity is
  //    enforced at the application level (deleteCatalog cleans up photos first).
  try {
    db.exec(`ALTER TABLE photos ADD COLUMN catalog_id INTEGER DEFAULT 1`);
  } catch {
    // Column already exists — safe to ignore
  }

  // 4. Assign all unassigned photos to catalog 1
  db.exec(`UPDATE photos SET catalog_id = 1 WHERE catalog_id IS NULL`);

  // 5. Index on catalog_id for efficient filtering
  db.exec(`CREATE INDEX IF NOT EXISTS idx_photos_catalog ON photos(catalog_id)`);

  // 6. EPIC-001 integrity fix: change UNIQUE(path) → UNIQUE(path, catalog_id).
  //    SQLite can't ALTER a constraint, so we rebuild photos via a temp table.
  //    The old UNIQUE index is named "sqlite_autoindex_photos_1".  We detect
  //    whether the new compound index already exists before running.
  migrateUniquePath(db);
}

function migrateUniquePath(db: Database.Database) {
  // Check if compound unique index already exists
  const exists = db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_photos_path_catalog'`
  ).get();
  if (exists) return; // already migrated

  console.log('[db] Migrating UNIQUE(path) → UNIQUE(path, catalog_id) …');

  db.exec(`
    -- Rebuild photos without the old UNIQUE(path) constraint
    CREATE TABLE photos_new (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      path        TEXT NOT NULL,
      filename    TEXT NOT NULL,
      year        INTEGER NOT NULL,
      event       TEXT NOT NULL,
      size_bytes  INTEGER,
      width       INTEGER,
      height      INTEGER,
      taken_at    TEXT,
      camera      TEXT,
      exposure    TEXT,
      gps_lat     REAL,
      gps_lon     REAL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      scanned_at  TEXT NOT NULL DEFAULT (datetime('now')),
      catalog_id  INTEGER NOT NULL DEFAULT 1,
      UNIQUE(path, catalog_id)
    );

    INSERT INTO photos_new SELECT * FROM photos;

    DROP TABLE photos;
    ALTER TABLE photos_new RENAME TO photos;

    -- Recreate all indexes
    CREATE INDEX IF NOT EXISTS idx_photos_year     ON photos(year);
    CREATE INDEX IF NOT EXISTS idx_photos_event    ON photos(year, event);
    CREATE INDEX IF NOT EXISTS idx_photos_fav      ON photos(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_photos_gps      ON photos(gps_lat, gps_lon);
    CREATE INDEX IF NOT EXISTS idx_photos_catalog  ON photos(catalog_id);
    CREATE UNIQUE INDEX idx_photos_path_catalog    ON photos(path, catalog_id);
  `);

  console.log('[db] Migration UNIQUE(path, catalog_id) complete.');
}
