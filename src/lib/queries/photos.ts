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
    ORDER BY p.taken_at ASC, p.filename ASC LIMIT ? OFFSET ?
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

  const catalogId = filters.catalogId ?? 1;
  const total = (db.prepare('SELECT COUNT(*) as c FROM photos WHERE catalog_id = ?').get(catalogId) as { c: number }).c;
  const years = (db.prepare('SELECT DISTINCT year FROM photos WHERE catalog_id = ? ORDER BY year DESC').all(catalogId) as { year: number }[]).map(r => r.year);

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

export function countPhotos(catalogId = 1): number {
  return (getDb().prepare('SELECT COUNT(*) as c FROM photos WHERE catalog_id = ?').get(catalogId) as { c: number }).c;
}

export function countFavorites(catalogId = 1): number {
  return (getDb().prepare('SELECT COUNT(*) as c FROM photos WHERE is_favorite = 1 AND catalog_id = ?').get(catalogId) as { c: number }).c;
}

export function countUntagged(catalogId = 1): number {
  return (getDb().prepare(`
    SELECT COUNT(*) as c FROM photos p
    WHERE catalog_id = ?
    AND NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id)
  `).get(catalogId) as { c: number }).c;
}

export function countWithGps(year?: number, catalogId = 1): number {
  if (year !== undefined) {
    return (getDb().prepare(
      'SELECT COUNT(*) as c FROM photos WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL AND year = ? AND catalog_id = ?'
    ).get(year, catalogId) as { c: number }).c;
  }
  return (getDb().prepare(
    'SELECT COUNT(*) as c FROM photos WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL AND catalog_id = ?'
  ).get(catalogId) as { c: number }).c;
}

// ── Years / navigation helpers ────────────────────────────────────────────────

export function getYears(catalogId = 1): number[] {
  return (getDb().prepare('SELECT DISTINCT year FROM photos WHERE catalog_id = ? ORDER BY year DESC').all(catalogId) as { year: number }[]).map(r => r.year);
}

export function hasPhotosForYear(year: number, catalogId = 1): boolean {
  return !!getDb().prepare('SELECT 1 FROM photos WHERE year = ? AND catalog_id = ? LIMIT 1').get(year, catalogId);
}

export function getPhotoSiblings(year: number, event: string, catalogId = 1): { id: number }[] {
  return getDb().prepare(
    'SELECT id FROM photos WHERE year = ? AND event = ? AND catalog_id = ? ORDER BY taken_at ASC, filename ASC'
  ).all(year, event, catalogId) as { id: number }[];
}

export interface AdjacentPhotos {
  prev: { id: number; thumbnail_url: string } | null;
  next: { id: number; thumbnail_url: string } | null;
}

function toAdjacent(id: number | undefined): { id: number; thumbnail_url: string } | null {
  if (!id) return null;
  return { id, thumbnail_url: `/api/v1/photos/${id}/thumbnail` };
}

export function getAdjacentInTimeline(photoId: number, catalogId = 1): AdjacentPhotos {
  const db = getDb();
  const photo = db.prepare('SELECT taken_at, filename FROM photos WHERE id = ? AND catalog_id = ?')
    .get(photoId, catalogId) as { taken_at: string | null; filename: string } | undefined;
  if (!photo) return { prev: null, next: null };

  const { taken_at, filename } = photo;

  const prevRow = taken_at
    ? db.prepare(`
        SELECT id FROM photos WHERE catalog_id = ?
          AND (taken_at < ? OR (taken_at = ? AND filename < ?))
        ORDER BY taken_at DESC, filename DESC LIMIT 1
      `).get(catalogId, taken_at, taken_at, filename) as { id: number } | undefined
    : undefined;

  const nextRow = taken_at
    ? db.prepare(`
        SELECT id FROM photos WHERE catalog_id = ?
          AND (taken_at > ? OR (taken_at = ? AND filename > ?))
        ORDER BY taken_at ASC, filename ASC LIMIT 1
      `).get(catalogId, taken_at, taken_at, filename) as { id: number } | undefined
    : undefined;

  return { prev: toAdjacent(prevRow?.id), next: toAdjacent(nextRow?.id) };
}

export function getAdjacentInEvent(photoId: number, catalogId = 1): AdjacentPhotos {
  const db = getDb();
  const photo = db.prepare('SELECT year, event, taken_at, filename FROM photos WHERE id = ? AND catalog_id = ?')
    .get(photoId, catalogId) as { year: number; event: string; taken_at: string | null; filename: string } | undefined;
  if (!photo) return { prev: null, next: null };

  const { year, event, taken_at, filename } = photo;

  const prevRow = taken_at
    ? db.prepare(`
        SELECT id FROM photos WHERE year = ? AND event = ? AND catalog_id = ?
          AND (taken_at < ? OR (taken_at = ? AND filename < ?))
        ORDER BY taken_at DESC, filename DESC LIMIT 1
      `).get(year, event, catalogId, taken_at, taken_at, filename) as { id: number } | undefined
    : undefined;

  const nextRow = taken_at
    ? db.prepare(`
        SELECT id FROM photos WHERE year = ? AND event = ? AND catalog_id = ?
          AND (taken_at > ? OR (taken_at = ? AND filename > ?))
        ORDER BY taken_at ASC, filename ASC LIMIT 1
      `).get(year, event, catalogId, taken_at, taken_at, filename) as { id: number } | undefined
    : undefined;

  return { prev: toAdjacent(prevRow?.id), next: toAdjacent(nextRow?.id) };
}

export function getAdjacentInTag(photoId: number, tagName: string, catalogId = 1): AdjacentPhotos {
  const db = getDb();
  const photo = db.prepare('SELECT taken_at, filename FROM photos WHERE id = ? AND catalog_id = ?')
    .get(photoId, catalogId) as { taken_at: string | null; filename: string } | undefined;
  if (!photo) return { prev: null, next: null };

  const { taken_at, filename } = photo;

  const prevRow = taken_at
    ? db.prepare(`
        SELECT p.id FROM photos p
        JOIN photo_tags pt ON pt.photo_id = p.id
        JOIN tags t ON t.id = pt.tag_id
        WHERE t.name = ? AND p.catalog_id = ?
          AND (p.taken_at < ? OR (p.taken_at = ? AND p.filename < ?))
        ORDER BY p.taken_at DESC, p.filename DESC LIMIT 1
      `).get(tagName, catalogId, taken_at, taken_at, filename) as { id: number } | undefined
    : undefined;

  const nextRow = taken_at
    ? db.prepare(`
        SELECT p.id FROM photos p
        JOIN photo_tags pt ON pt.photo_id = p.id
        JOIN tags t ON t.id = pt.tag_id
        WHERE t.name = ? AND p.catalog_id = ?
          AND (p.taken_at > ? OR (p.taken_at = ? AND p.filename > ?))
        ORDER BY p.taken_at ASC, p.filename ASC LIMIT 1
      `).get(tagName, catalogId, taken_at, taken_at, filename) as { id: number } | undefined
    : undefined;

  return { prev: toAdjacent(prevRow?.id), next: toAdjacent(nextRow?.id) };
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

const MAP_LIMIT = 5000;

export function getMapYears(catalogId = 1): number[] {
  return (getDb().prepare(
    'SELECT DISTINCT year FROM photos WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL AND catalog_id = ? ORDER BY year DESC'
  ).all(catalogId) as { year: number }[]).map(r => r.year);
}

export function getMapPhotos(year?: number, catalogId = 1): { photos: MapPhoto[]; limitReached: boolean } {
  const db = getDb();
  const rows = year !== undefined
    ? db.prepare(`
        SELECT id, filename, taken_at, event, gps_lat, gps_lon
        FROM photos
        WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL AND year = ? AND catalog_id = ?
        ORDER BY taken_at ASC NULLS LAST
      `).all(year, catalogId) as MapPhoto[]
    : db.prepare(`
        SELECT id, filename, taken_at, event, gps_lat, gps_lon
        FROM photos
        WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL AND catalog_id = ?
        ORDER BY taken_at DESC NULLS LAST
        LIMIT ${MAP_LIMIT + 1}
      `).all(catalogId) as MapPhoto[];

  if (year !== undefined) {
    return { photos: rows, limitReached: false };
  }
  const limitReached = rows.length > MAP_LIMIT;
  return { photos: limitReached ? rows.slice(0, MAP_LIMIT) : rows, limitReached };
}
