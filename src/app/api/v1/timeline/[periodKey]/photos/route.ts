import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Infer strftime format from periodKey length: "2024" → year, "2024-08" → month, "2024-08-15" → day */
function fmtFromKey(periodKey: string): string {
  if (periodKey.length === 4)  return '%Y';
  if (periodKey.length === 7)  return '%Y-%m';
  return '%Y-%m-%d';
}

interface PhotoRow {
  id: number;
  filename: string;
  taken_at: string | null;
  gps_lat: number | null;
  gps_lon: number | null;
}

interface Params { params: Promise<{ periodKey: string }> }

export function GET(req: NextRequest, { params }: Params) {
  return withAuth(async (_req, session) => {
    const { periodKey } = await params;
    if (!periodKey || !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(periodKey)) {
      return apiError('BAD_REQUEST', 'Invalid periodKey format', 400);
    }

    const sp        = req.nextUrl.searchParams;
    const limit     = Math.min(Math.max(parseInt(sp.get('limit') ?? '50', 10) || 50, 1), 500);
    const cursor    = sp.get('cursor') ?? null;
    const catalogId = session.catalogId ?? 1;
    const fmt       = fmtFromKey(periodKey);

    let decodedCursor: { taken_at: string; id: number } | null = null;
    if (cursor) {
      try {
        const [takenAt, idStr] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
        decodedCursor = { taken_at: takenAt, id: parseInt(idStr, 10) };
      } catch {}
    }

    const db = getDb();

    const rows: PhotoRow[] = decodedCursor
      ? db.prepare(`
          SELECT id, filename, taken_at, gps_lat, gps_lon
          FROM photos
          WHERE catalog_id = ? AND strftime(?, taken_at) = ?
            AND (taken_at > ? OR (taken_at = ? AND id > ?))
          ORDER BY taken_at ASC, id ASC
          LIMIT ?
        `).all(catalogId, fmt, periodKey, decodedCursor.taken_at, decodedCursor.taken_at, decodedCursor.id, limit + 1) as PhotoRow[]
      : db.prepare(`
          SELECT id, filename, taken_at, gps_lat, gps_lon
          FROM photos
          WHERE catalog_id = ? AND strftime(?, taken_at) = ?
          ORDER BY taken_at ASC, id ASC
          LIMIT ?
        `).all(catalogId, fmt, periodKey, limit + 1) as PhotoRow[];

    const hasMore = rows.length > limit;
    const page    = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1];
      nextCursor = Buffer.from(`${last.taken_at}|${last.id}`, 'utf8').toString('base64url');
    }

    const total = (db.prepare(
      `SELECT COUNT(*) as c FROM photos WHERE catalog_id = ? AND strftime(?, taken_at) = ?`
    ).get(catalogId, fmt, periodKey) as { c: number }).c;

    const data = page.map(r => ({
      ...r,
      thumbnail_url: `/api/v1/photos/${r.id}/thumbnail`,
    }));

    return apiSuccess(data, { total, hasMore, nextCursor, limit });
  })(req);
}
