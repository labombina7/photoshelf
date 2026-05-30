import { getDb } from '@/lib/db';

export interface TimelinePhotoRow {
  id: number;
  filename: string;
  taken_at: string | null;
  tags_preview: string | null;
}

export interface TimelineResult {
  rows: TimelinePhotoRow[];
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * Fetch a page of photos for the timeline, ordered newest-first.
 *
 * @param limit     Number of photos to return (exclusive — internally fetches limit+1 to detect hasMore).
 * @param cursor    Exclusive upper-bound ISO date string (taken_at of the first photo in the NEXT page).
 * @param catalogId Active catalog ID (default 1).
 */
export function getTimelineRows(limit: number, cursor?: string | null, catalogId = 1): TimelineResult {
  const db = getDb();

  // Outer query references 'name' (not 't.name') — the derived table exposes the column without alias
  const tagsSql = `(SELECT GROUP_CONCAT(name, ', ') FROM (SELECT t.name FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.photo_id = p.id LIMIT 3)) AS tags_preview`;
  // Use CASE instead of NULLS LAST (compatible with SQLite < 3.30) and p.id instead of p.created_at
  const orderBy = `CASE WHEN p.taken_at IS NULL THEN 1 ELSE 0 END ASC, p.taken_at DESC, p.id DESC`;
  const rows: TimelinePhotoRow[] = cursor
    ? db.prepare(`
        SELECT p.id, p.filename, p.taken_at, ${tagsSql} FROM photos p
        WHERE p.catalog_id = ? AND (p.taken_at IS NULL OR p.taken_at < ?)
        ORDER BY ${orderBy} LIMIT ?
      `).all(catalogId, cursor, limit + 1) as TimelinePhotoRow[]
    : db.prepare(`
        SELECT p.id, p.filename, p.taken_at, ${tagsSql} FROM photos p
        WHERE p.catalog_id = ?
        ORDER BY ${orderBy} LIMIT ?
      `).all(catalogId, limit + 1) as TimelinePhotoRow[];

  const hasMore = rows.length > limit;
  const page    = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | null = null;
  if (hasMore) {
    const lastDated = [...page].reverse().find(r => r.taken_at !== null);
    nextCursor = lastDated?.taken_at ?? null;
  }

  return { rows: page, hasMore, nextCursor };
}
