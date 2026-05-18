import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

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
  `);
}
