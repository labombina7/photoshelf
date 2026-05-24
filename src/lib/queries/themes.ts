import { getDb } from '@/lib/db';
import type { Theme } from '@/lib/types';

export interface ThemeWithCount extends Theme {
  photo_count: number;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function listThemes(): ThemeWithCount[] {
  return getDb().prepare(`
    SELECT th.id, th.name, th.color, COUNT(pt.photo_id) as photo_count
    FROM themes th LEFT JOIN photo_themes pt ON pt.theme_id = th.id
    GROUP BY th.id ORDER BY th.name ASC
  `).all() as ThemeWithCount[];
}

export function getPhotoThemes(photoId: number): Theme[] {
  return getDb().prepare(`
    SELECT th.id, th.name, th.color
    FROM photo_themes pt JOIN themes th ON th.id = pt.theme_id
    WHERE pt.photo_id = ?
  `).all(photoId) as Theme[];
}

// ── Write ─────────────────────────────────────────────────────────────────────

export function createTheme(name: string, color = '#888888'): { id: number; name: string; color: string } {
  const db = getDb();
  const result = db.prepare('INSERT INTO themes (name, color) VALUES (?, ?)').run(name, color);
  return { id: result.lastInsertRowid as number, name, color };
}

export function updateTheme(id: number, name?: string, color?: string): void {
  const db = getDb();
  if (name)  db.prepare('UPDATE themes SET name  = ? WHERE id = ?').run(name,  id);
  if (color) db.prepare('UPDATE themes SET color = ? WHERE id = ?').run(color, id);
}

export function deleteTheme(id: number): void {
  getDb().prepare('DELETE FROM themes WHERE id = ?').run(id);
}

// ── Photo ↔ theme associations ────────────────────────────────────────────────

export function addThemeToPhoto(photoId: number, themeId: number): void {
  getDb().prepare(
    'INSERT OR IGNORE INTO photo_themes (photo_id, theme_id) VALUES (?, ?)'
  ).run(photoId, themeId);
}

/** Replace all themes for a photo in a single transaction. */
export function setPhotoThemes(photoId: number, themeIds: number[]): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM photo_themes WHERE photo_id = ?').run(photoId);
    for (const tid of themeIds) {
      db.prepare('INSERT OR IGNORE INTO photo_themes (photo_id, theme_id) VALUES (?, ?)').run(photoId, tid);
    }
  })();
}
