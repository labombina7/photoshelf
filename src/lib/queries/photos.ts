import { getDb } from '@/lib/db';
import { buildPhotoFilter } from '@/lib/db-helpers';
import type { PhotoFilters } from '@/lib/db-helpers';
import type { Photo, Tag, Theme, PhotoDetail } from '@/lib/types';

export type { PhotoFilters };

export interface PhotoWithTags extends Photo {
  tags: { name: string; source: string }[];
}

export interface PhotoListResult {
  photos: PhotoWithTags[];
  total: number;
  years: number[];
}

// ── List / filter ─────────────────────────────────────────────────────────────

export function listPhotos(
  filters: PhotoFilters,
  pagination: { limit: number; offset: number },
): PhotoListResult {
  const db = getDb();
  const { joinSql, whereSql, params: fp } = buildPhotoFilter(filters);
  const { limit, offset } = pagination;

  const rows = db.prepare(`
    SELECT DISTINCT p.*
    FROM photos p
    ${joinSql}
    WHERE 1=1
    ${whereSql}
    ORDER BY p.taken_at DESC, p.filename ASC LIMIT ? OFFSET ?
  `).all(...fp, limit, offset) as Record<string, unknown>[];

  let photos: PhotoWithTags[];
  if (rows.length === 0) {
    photos = [];
  } else {
    const ids = rows.map(p => p.id as number);
    const ph  = ids.map(() => '?').join(',');
    const tagRows = db.prepare(
      `SELECT pt.photo_id, t.name, pt.source
       FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id
       WHERE pt.photo_id IN (${ph})`
    ).all(...ids) as { photo_id: number; name: string; source: string }[];

    const tagMap = new Map<number, { name: string; source: string }[]>();
    for (const row of tagRows) {
      const arr = tagMap.get(row.photo_id);
      if (arr) arr.push({ name: row.name, source: row.source });
      else tagMap.set(row.photo_id, [{ name: row.name, source: row.source }]);
    }

    photos = rows.map(p => ({
      ...(p as unknown as Photo),
      tags: tagMap.get(p.id as number) ?? [],
    }));
  }

  const total = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;
  const years = (db.prepare('SELECT DISTINCT year FROM photos ORDER BY year DESC').all() as { year: number }[]).map(r => r.year);

  return { photos, total, years };
}

// ── Single photo ──────────────────────────────────────────────────────────────

export function getPhotoById(id: number): PhotoDetail | null {
  const db = getDb();
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as Photo | undefined;
  if (!photo) return null;

  const tags = db.prepare(
    'SELECT t.id, t.name, pt.source FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.photo_id = ?'
  ).all(id) as Tag[];

  const themes = db.prepare(`
    SELECT th.id, th.name, th.color
    FROM photo_themes pt JOIN themes th ON th.id = pt.theme_id
    WHERE pt.photo_id = ?
  `).all(id) as Theme[];

  return { ...photo, tags, themes };
}

export function getPhotoPath(id: number): string | null {
  const row = getDb().prepare('SELECT path FROM photos WHERE id = ?').get(id) as { path: string } | undefined;
  return row?.path ?? null;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function setFavorite(id: number, value: boolean): void {
  getDb().prepare('UPDATE photos SET is_favorite = ? WHERE id = ?').run(value ? 1 : 0, id);
}

// ── Aggregate counts ──────────────────────────────────────────────────────────

export function countPhotos(): number {
  return (getDb().prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;
}

export function countFavorites(): number {
  return (getDb().prepare('SELECT COUNT(*) as c FROM photos WHERE is_favorite = 1').get() as { c: number }).c;
}

export function countUntagged(): number {
  return (getDb().prepare(`
    SELECT COUNT(*) as c FROM photos p
    WHERE NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id)
  `).get() as { c: number }).c;
}

export function countWithGps(): number {
  return (getDb().prepare(
    'SELECT COUNT(*) as c FROM photos WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL'
  ).get() as { c: number }).c;
}

// ── Years / navigation helpers ────────────────────────────────────────────────

export function getYears(): number[] {
  return (getDb().prepare('SELECT DISTINCT year FROM photos ORDER BY year DESC').all() as { year: number }[]).map(r => r.year);
}

export function hasPhotosForYear(year: number): boolean {
  return !!getDb().prepare('SELECT 1 FROM photos WHERE year = ? LIMIT 1').get(year);
}

export function getPhotoSiblings(year: number, event: string): { id: number }[] {
  return getDb().prepare(
    'SELECT id FROM photos WHERE year = ? AND event = ? ORDER BY taken_at ASC, filename ASC'
  ).all(year, event) as { id: number }[];
}

// ── Map ───────────────────────────────────────────────────────────────────────

export interface MapPhoto {
  id: number;
  filename: string;
  taken_at: string | null;
  event: string;
  gps_lat: number;
  gps_lon: number;
}

export function getMapPhotos(): MapPhoto[] {
  return getDb().prepare(`
    SELECT id, filename, taken_at, event, gps_lat, gps_lon
    FROM photos
    WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL
    ORDER BY taken_at DESC NULLS LAST
    LIMIT 10000
  `).all() as MapPhoto[];
}
