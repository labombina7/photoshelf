import { getDb } from '@/lib/db';
import { buildSmartAlbumQuery, rulesFromJson, type AlbumRule } from '@/lib/smartAlbumQuery';
import type { EventGroupRow } from './groups';

export interface SmartAlbumRow {
  id: number;
  name: string;
  rules: string;
  created_at: string;
}

export interface SmartAlbumWithCount extends SmartAlbumRow {
  photo_count: number;
  cover_photo_id: number | null;
}

export function listSmartAlbums(catalogId = 1): SmartAlbumWithCount[] {
  const db = getDb();
  const albums = db.prepare('SELECT * FROM smart_albums ORDER BY created_at DESC').all() as SmartAlbumRow[];

  return albums.map(album => {
    const rules = rulesFromJson(album.rules);
    const { joinSql, whereSql, params } = buildSmartAlbumQuery(rules, catalogId);
    const row = db.prepare(`
      SELECT COUNT(DISTINCT p.id) as c, MIN(p.id) as cover_id
      FROM photos p
      ${joinSql}
      WHERE 1=1
      ${whereSql}
    `).get(...params) as { c: number; cover_id: number | null };
    return { ...album, photo_count: row.c, cover_photo_id: row.cover_id };
  });
}

export function getSmartAlbumById(id: number): SmartAlbumRow | null {
  return getDb().prepare('SELECT * FROM smart_albums WHERE id = ?').get(id) as SmartAlbumRow | null;
}

export function getSmartAlbumGroups(rules: AlbumRule[], catalogId = 1): { groups: EventGroupRow[]; total: number } {
  const db = getDb();
  const { joinSql, whereSql, params } = buildSmartAlbumQuery(rules, catalogId);

  const groups = db.prepare(`
    SELECT p.year, p.event, COUNT(DISTINCT p.id) as count, MIN(p.id) as thumbnail_id
    FROM photos p
    ${joinSql}
    WHERE 1=1
    ${whereSql}
    GROUP BY p.year, p.event ORDER BY p.year DESC, p.event ASC
  `).all(...params) as EventGroupRow[];

  const total = groups.reduce((sum, g) => sum + g.count, 0);
  return { groups, total };
}

export function createSmartAlbum(name: string, rules: AlbumRule[]): number {
  const result = getDb().prepare(
    'INSERT INTO smart_albums (name, rules) VALUES (?, ?)'
  ).run(name, JSON.stringify(rules));
  return result.lastInsertRowid as number;
}

export function updateSmartAlbum(id: number, data: { name?: string; rules?: AlbumRule[] }): void {
  const db = getDb();
  if (data.name !== undefined) {
    db.prepare('UPDATE smart_albums SET name = ? WHERE id = ?').run(data.name, id);
  }
  if (data.rules !== undefined) {
    db.prepare('UPDATE smart_albums SET rules = ? WHERE id = ?').run(JSON.stringify(data.rules), id);
  }
}

export function deleteSmartAlbum(id: number): void {
  getDb().prepare('DELETE FROM smart_albums WHERE id = ?').run(id);
}

export function getSidebarSmartAlbums(): { id: number; name: string }[] {
  return getDb().prepare('SELECT id, name FROM smart_albums ORDER BY created_at DESC').all() as { id: number; name: string }[];
}
