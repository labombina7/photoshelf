import { getDb } from '@/lib/db';
import { buildSmartAlbumQuery, rulesFromJson, type AlbumRule } from '@/lib/smartAlbumQuery';

export interface SmartAlbumRow {
  id: number;
  name: string;
  rules: string;
  created_at: string;
  source: 'manual' | 'auto';
  catalog_id: number | null;
}

export interface SmartAlbumWithCount extends SmartAlbumRow {
  photo_count: number;
  cover_photo_id: number | null;
}

export function listSmartAlbums(catalogId = 1): SmartAlbumWithCount[] {
  const db = getDb();
  const albums = db.prepare(
    'SELECT * FROM smart_albums WHERE catalog_id = ? ORDER BY created_at DESC'
  ).all(catalogId) as SmartAlbumRow[];

  return albums.map(album => {
    const rules = rulesFromJson(album.rules);
    const { whereSql, params } = buildSmartAlbumQuery(rules, catalogId);
    const row = db.prepare(`
      SELECT COUNT(DISTINCT p.id) as c, MIN(p.id) as cover_id
      FROM photos p
      WHERE 1=1
      ${whereSql}
    `).get(...params) as { c: number; cover_id: number | null };
    return { ...album, photo_count: row.c, cover_photo_id: row.cover_id };
  });
}

export function getSmartAlbumById(id: number): SmartAlbumRow | null {
  return getDb().prepare('SELECT * FROM smart_albums WHERE id = ?').get(id) as SmartAlbumRow | null;
}

export interface AlbumPhotoRow {
  id: number;
  filename: string;
  taken_at: string | null;
  tags_preview: string | null;
}

export interface AlbumPhotosResult {
  rows: AlbumPhotoRow[];
  hasMore: boolean;
  nextCursor: string | null;
  total: number;
}

export function getSmartAlbumPhotos(rules: AlbumRule[], catalogId = 1, limit = 120, cursor?: string | null): AlbumPhotosResult {
  const db = getDb();
  const { whereSql, params } = buildSmartAlbumQuery(rules, catalogId);
  const tagsSql = `(SELECT GROUP_CONCAT(t.name, ', ') FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.photo_id = p.id LIMIT 3) AS tags_preview`;
  const orderBy = `CASE WHEN p.taken_at IS NULL THEN 1 ELSE 0 END ASC, p.taken_at DESC, p.id DESC`;

  const rows: AlbumPhotoRow[] = cursor
    ? db.prepare(`
        SELECT p.id, p.filename, p.taken_at, ${tagsSql}
        FROM photos p
        WHERE 1=1 ${whereSql}
        AND (p.taken_at IS NULL OR p.taken_at < ?)
        ORDER BY ${orderBy} LIMIT ?
      `).all(...params, cursor, limit + 1) as AlbumPhotoRow[]
    : db.prepare(`
        SELECT p.id, p.filename, p.taken_at, ${tagsSql}
        FROM photos p
        WHERE 1=1 ${whereSql}
        ORDER BY ${orderBy} LIMIT ?
      `).all(...params, limit + 1) as AlbumPhotoRow[];

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  let nextCursor: string | null = null;
  if (hasMore) {
    const lastDated = [...page].reverse().find(r => r.taken_at !== null);
    nextCursor = lastDated?.taken_at ?? null;
  }

  const totalRow = db.prepare(`
    SELECT COUNT(DISTINCT p.id) as c FROM photos p WHERE 1=1 ${whereSql}
  `).get(...params) as { c: number };

  return { rows: page, hasMore, nextCursor, total: totalRow.c };
}

export function createSmartAlbum(name: string, rules: AlbumRule[], catalogId = 1): number {
  const result = getDb().prepare(
    'INSERT INTO smart_albums (name, rules, catalog_id) VALUES (?, ?, ?)'
  ).run(name, JSON.stringify(rules), catalogId);
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

export function getSidebarSmartAlbums(catalogId = 1): { id: number; name: string }[] {
  return getDb().prepare(
    'SELECT id, name FROM smart_albums WHERE catalog_id = ? ORDER BY created_at DESC'
  ).all(catalogId) as { id: number; name: string }[];
}

export function createAutoAlbum(name: string, rules: AlbumRule[], catalogId: number): number {
  const result = getDb().prepare(
    "INSERT INTO smart_albums (name, rules, source, catalog_id) VALUES (?, ?, 'auto', ?)"
  ).run(name, JSON.stringify(rules), catalogId);
  return result.lastInsertRowid as number;
}

export function deleteAutoAlbumsForCatalog(catalogId: number): number {
  const result = getDb().prepare(
    "DELETE FROM smart_albums WHERE source = 'auto' AND catalog_id = ?"
  ).run(catalogId);
  return result.changes;
}

export function hasAutoAlbums(catalogId: number): boolean {
  const row = getDb().prepare(
    "SELECT COUNT(*) as n FROM smart_albums WHERE source = 'auto' AND catalog_id = ?"
  ).get(catalogId) as { n: number };
  return row.n > 0;
}
