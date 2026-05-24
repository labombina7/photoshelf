import { getDb } from '@/lib/db';

export interface TimelinePhotoRow {
  id: number;
  filename: string;
  taken_at: string | null;
}

export interface TimelineResult {
  rows: TimelinePhotoRow[];
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * Fetch a page of photos for the timeline, ordered newest-first.
 *
 * @param limit   Number of photos to return (exclusive — internally fetches limit+1 to detect hasMore).
 * @param cursor  Exclusive upper-bound ISO date string (taken_at of the first photo in the NEXT page).
 */
export function getTimelineRows(limit: number, cursor?: string | null): TimelineResult {
  const db = getDb();

  const rows: TimelinePhotoRow[] = cursor
    ? db.prepare(`
        SELECT id, filename, taken_at FROM photos
        WHERE (taken_at IS NULL OR taken_at < ?)
        ORDER BY taken_at DESC NULLS LAST, created_at DESC LIMIT ?
      `).all(cursor, limit + 1) as TimelinePhotoRow[]
    : db.prepare(`
        SELECT id, filename, taken_at FROM photos
        ORDER BY taken_at DESC NULLS LAST, created_at DESC LIMIT ?
      `).all(limit + 1) as TimelinePhotoRow[];

  const hasMore = rows.length > limit;
  const page    = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | null = null;
  if (hasMore) {
    const lastDated = [...page].reverse().find(r => r.taken_at !== null);
    nextCursor = lastDated?.taken_at ?? null;
  }

  return { rows: page, hasMore, nextCursor };
}
