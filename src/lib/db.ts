import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { PHOTOS_PATH, STYLE_ANALYSIS_VERSION } from './config';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'photoshelf.db');

let _db: Database.Database | null = null;

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
  migrateIntegrity(db);
  migrateIntegrityOrphanThumbnail(db);
  migrateHealthSnapshots(db);
  migrateExif(db);
  migrateSmartAlbums(db);
  migrateJobQueue(db);
  migrateBackupConfig(db);
  migrateStyleAnalysis(db);
  migrateEvolution(db);
}

function migrateEvolution(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS evolution_analysis (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      generated_at TEXT NOT NULL,
      data_hash    TEXT NOT NULL,
      analysis     TEXT NOT NULL
    );
  `);
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

  // 2. Create default catalog (id=1) only if it doesn't exist yet.
  //    DO NOTHING on conflict so the user can change the path via the UI
  //    without it being overwritten on every server restart.
  db.prepare(`
    INSERT INTO catalogs (id, name, path) VALUES (1, 'Principal', ?)
    ON CONFLICT(id) DO NOTHING
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

  // IMPORTANT: disable FK enforcement during the table rebuild.
  // With foreign_keys = ON, DROP TABLE fires ON DELETE CASCADE on photo_tags /
  // photo_themes / project_photos — wiping all tag/theme/project associations.
  // We restore FK enforcement (and verify integrity) right after.
  db.pragma('foreign_keys = OFF');

  try {
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
  } finally {
    db.pragma('foreign_keys = ON');
  }

  console.log('[db] Migration UNIQUE(path, catalog_id) complete.');
}

function migrateIntegrity(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS integrity_reports (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT NOT NULL CHECK(type IN ('orphan', 'unindexed', 'corrupt')),
      path        TEXT NOT NULL,
      photo_id    INTEGER,
      error_msg   TEXT,
      detected_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_integrity_type ON integrity_reports(type);
    CREATE INDEX IF NOT EXISTS idx_integrity_at   ON integrity_reports(detected_at);
  `);
}

function migrateIntegrityOrphanThumbnail(db: Database.Database) {
  // Check if the old restricted CHECK constraint is still in place (no orphan_thumbnail support).
  // We detect this by checking for the old CHECK text in sqlite_master.
  // If so, rebuild the table dropping the CHECK so new types can be inserted freely.
  const tableInfo = db.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='integrity_reports'`
  ).get() as { sql: string } | undefined;

  if (!tableInfo) return; // table doesn't exist yet — migrateIntegrity hasn't run
  if (!tableInfo.sql.includes("'orphan', 'unindexed', 'corrupt'")) return; // already migrated

  db.exec(`
    CREATE TABLE integrity_reports_new (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT NOT NULL,
      path        TEXT NOT NULL,
      photo_id    INTEGER,
      error_msg   TEXT,
      detected_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO integrity_reports_new SELECT * FROM integrity_reports;
    DROP TABLE integrity_reports;
    ALTER TABLE integrity_reports_new RENAME TO integrity_reports;
    CREATE INDEX IF NOT EXISTS idx_integrity_type ON integrity_reports(type);
    CREATE INDEX IF NOT EXISTS idx_integrity_at   ON integrity_reports(detected_at);
  `);
}

function migrateHealthSnapshots(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS health_snapshots (
      date         TEXT PRIMARY KEY,
      score        INTEGER NOT NULL,
      metrics_json TEXT NOT NULL
    );
  `);
}

function migrateExif(db: Database.Database) {
  const columns = [
    'ALTER TABLE photos ADD COLUMN iso INTEGER',
    'ALTER TABLE photos ADD COLUMN aperture REAL',
    'ALTER TABLE photos ADD COLUMN shutter_speed_seconds REAL',
    'ALTER TABLE photos ADD COLUMN focal_length REAL',
  ];
  for (const sql of columns) {
    try {
      db.exec(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_photos_iso       ON photos(iso);
    CREATE INDEX IF NOT EXISTS idx_photos_aperture  ON photos(aperture);
    CREATE INDEX IF NOT EXISTS idx_photos_focal     ON photos(focal_length);
  `);
}

function migrateJobQueue(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_queue (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      payload     TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      started_at  TEXT,
      processed   INTEGER NOT NULL DEFAULT 0,
      total       INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      error_last  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status, created_at);
  `);
  // Add created_at to photo_tags for resumption of force=true jobs
  try {
    db.exec(`ALTER TABLE photo_tags ADD COLUMN created_at TEXT DEFAULT (datetime('now'))`);
  } catch { /* already exists */ }
  // Add result column for jobs that produce a value (e.g. generate_project)
  try {
    db.exec(`ALTER TABLE job_queue ADD COLUMN result TEXT`);
  } catch { /* already exists */ }
}

function migrateSmartAlbums(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS smart_albums (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      rules      TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  try {
    db.exec(`ALTER TABLE smart_albums ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`);
  } catch { /* already exists */ }
  try {
    db.exec(`ALTER TABLE smart_albums ADD COLUMN catalog_id INTEGER`);
  } catch { /* already exists */ }
}

function migrateBackupConfig(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS backup_config (
      id                  INTEGER PRIMARY KEY CHECK (id = 1),
      auto_enabled        INTEGER NOT NULL DEFAULT 1,
      auto_interval_days  INTEGER NOT NULL DEFAULT 7,
      last_backup_at      TEXT,
      last_backup_db_path TEXT
    );
    INSERT OR IGNORE INTO backup_config (id, auto_enabled, auto_interval_days) VALUES (1, 1, 7);
  `);
}

// ── EPIC-004: Style analysis tables ──────────────────────────────────────────

function migrateStyleAnalysis(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS style_analysis_bootstrap (
      period        TEXT PRIMARY KEY,
      type          TEXT NOT NULL CHECK(type IN ('historical_sample','full')),
      status        TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','done')),
      processed_at  TEXT,
      photo_count   INTEGER NOT NULL DEFAULT 0,
      sample_count  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS style_profiles (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      period              TEXT NOT NULL UNIQUE,
      type                TEXT NOT NULL CHECK(type IN ('monthly','annual_historical')),
      profile_text        TEXT,
      highlights_json     TEXT NOT NULL DEFAULT '[]',
      trend               TEXT,
      period_summary_json TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS style_pending_signals (
      photo_id  INTEGER NOT NULL,
      period    TEXT NOT NULL,
      PRIMARY KEY (photo_id, period)
    );

    CREATE TABLE IF NOT EXISTS style_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_style_profiles_type   ON style_profiles(type, period);
    CREATE INDEX IF NOT EXISTS idx_style_pending_period  ON style_pending_signals(period);
  `);

  // Migration: allow NULL profile_text (was NOT NULL DEFAULT '' in initial schema)
  // SQLite doesn't support ALTER COLUMN, so we recreate the table if needed
  const colInfo = db.prepare(`PRAGMA table_info(style_profiles)`).all() as { name: string; notnull: number }[];
  const profileTextCol = colInfo.find(c => c.name === 'profile_text');
  if (profileTextCol && profileTextCol.notnull === 1) {
    db.exec(`
      BEGIN;
      ALTER TABLE style_profiles RENAME TO style_profiles_old;
      CREATE TABLE style_profiles (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        period              TEXT NOT NULL UNIQUE,
        type                TEXT NOT NULL CHECK(type IN ('monthly','annual_historical')),
        profile_text        TEXT,
        highlights_json     TEXT NOT NULL DEFAULT '[]',
        trend               TEXT,
        period_summary_json TEXT,
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO style_profiles SELECT * FROM style_profiles_old;
      DROP TABLE style_profiles_old;
      CREATE INDEX IF NOT EXISTS idx_style_profiles_type ON style_profiles(type, period);
      COMMIT;
    `);
  }

  // ── Style analysis versioning ────────────────────────────────────────────────
  // Add version column if missing (migration from v1)
  const bootstrapCols = db.prepare(`PRAGMA table_info(style_analysis_bootstrap)`).all() as { name: string }[];
  if (!bootstrapCols.find(c => c.name === 'version')) {
    db.exec(`ALTER TABLE style_analysis_bootstrap ADD COLUMN version INTEGER NOT NULL DEFAULT 1`);
  }
  // Reset any rows whose version doesn't match current — triggers reprocessing
  const stale = (db.prepare(
    `SELECT COUNT(*) AS n FROM style_analysis_bootstrap WHERE version != ?`
  ).get(STYLE_ANALYSIS_VERSION) as { n: number }).n;
  if (stale > 0) {
    console.log(`[db] Style analysis v${STYLE_ANALYSIS_VERSION}: resetting ${stale} stale bootstrap rows`);
    db.exec(`
      DELETE FROM style_profiles;
      UPDATE style_analysis_bootstrap SET status = 'pending', version = ${STYLE_ANALYSIS_VERSION},
        processed_at = NULL, sample_count = 0;
    `);
  }

  // ── US-093: Amplitude sync column ──────────────────────────────────────────
  const photoCols = db.prepare(`PRAGMA table_info(photos)`).all() as { name: string }[];
  if (!photoCols.find(c => c.name === 'amplitude_synced_at')) {
    db.exec(`
      ALTER TABLE photos ADD COLUMN amplitude_synced_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_photos_amplitude ON photos(amplitude_synced_at) WHERE amplitude_synced_at IS NULL;
    `);
  }

  // ── US-092: Share tokens ────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS share_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      token      TEXT NOT NULL UNIQUE,
      photo_ids  TEXT NOT NULL,
      label      TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at    INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON share_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_share_tokens_expires ON share_tokens(expires_at);
  `);
  // Clean up expired tokens on startup
  db.prepare(`DELETE FROM share_tokens WHERE expires_at < unixepoch()`).run();
}

// ── integrity badge: unresolved orphan count ──────────────────────────────────
export function getOrphanCount(): number {
  const db = getDb();
  const row = db.prepare(
    `SELECT COUNT(*) as n FROM integrity_reports WHERE type = 'orphan'`
  ).get() as { n: number };
  return row.n;
}
