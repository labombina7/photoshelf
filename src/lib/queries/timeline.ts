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

  const tagsSql = `(SELECT GROUP_CONCAT(t.name, ', ') FROM (SELECT t.name FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.photo_id = p.id LIMIT 3)) AS tags_preview`;
  const rows: TimelinePhotoRow[] = cursor
    ? db.prepare(`
        SELECT p.id, p.filename, p.taken_at, ${tagsSql} FROM photos p
        WHERE p.catalog_id = ? AND (p.taken_at IS NULL OR p.taken_at < ?)
        ORDER BY p.taken_at DESC NULLS LAST, p.created_at DESC LIMIT ?
      `).all(catalogId, cursor, limit + 1) as TimelinePhotoRow[]
    : db.prepare(`
        SELECT p.id, p.filename, p.taken_at, ${tagsSql} FROM photos p
        WHERE p.catalog_id = ?
        ORDER BY p.taken_at DESC NULLS LAST, p.created_at DESC LIMIT ?
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
