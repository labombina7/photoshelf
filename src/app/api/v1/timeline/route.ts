import { NextRequest } from 'next/server';
import { withAuth, apiSuccess } from '@/lib/api';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

type ZoomLevel = 'year' | 'month' | 'day';

function zoomToFormat(zoom: number): { fmt: string; level: ZoomLevel } {
  if (zoom <= 1) return { fmt: '%Y', level: 'year' };
  if (zoom <= 3) return { fmt: '%Y-%m', level: 'month' };
  return { fmt: '%Y-%m-%d', level: 'day' };
}

function formatLabel(periodKey: string, level: ZoomLevel): string {
  if (level === 'year') return periodKey;
  if (level === 'month') {
    const [y, m] = periodKey.split('-');
    return new Date(Number(y), Number(m) - 1, 1)
      .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }
  const [y, m, d] = periodKey.split('-').map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface PeriodRow { period_key: string; count: number; thumbnail_id: number; }

export const GET = withAuth(async (req: NextRequest, session) => {
  const sp        = req.nextUrl.searchParams;
  const zoom      = Math.max(1, parseInt(sp.get('zoom') ?? '2', 10));
  const limit     = Math.min(Math.max(parseInt(sp.get('limit') ?? '50', 10) || 50, 1), 200);
  const cursor    = sp.get('cursor') ?? null;
  const catalogId = session.catalogId ?? 1;

  const { fmt, level } = zoomToFormat(zoom);

  let decodedCursor: string | null = null;
  if (cursor) {
    try { decodedCursor = Buffer.from(cursor, 'base64url').toString('utf8'); } catch {}
  }

  const db = getDb();

  const rows: PeriodRow[] = decodedCursor
    ? db.prepare(`
        SELECT strftime(?, taken_at) as period_key, COUNT(*) as count, MIN(id) as thumbnail_id
        FROM photos
        WHERE catalog_id = ? AND taken_at IS NOT NULL
          AND strftime(?, taken_at) < ?
        GROUP BY period_key
        ORDER BY period_key DESC
        LIMIT ?
      `).all(fmt, catalogId, fmt, decodedCursor, limit + 1) as PeriodRow[]
    : db.prepare(`
        SELECT strftime(?, taken_at) as period_key, COUNT(*) as count, MIN(id) as thumbnail_id
        FROM photos
        WHERE catalog_id = ? AND taken_at IS NOT NULL
        GROUP BY period_key
        ORDER BY period_key DESC
        LIMIT ?
      `).all(fmt, catalogId, limit + 1) as PeriodRow[];

  const hasMore = rows.length > limit;
  const page    = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | null = null;
  if (hasMore && page.length > 0) {
    nextCursor = Buffer.from(page[page.length - 1].period_key, 'utf8').toString('base64url');
  }

  const total = (db.prepare(
    `SELECT COUNT(DISTINCT strftime(?, taken_at)) as c FROM photos WHERE catalog_id = ? AND taken_at IS NOT NULL`
  ).get(fmt, catalogId) as { c: number }).c;

  const data = page.map(r => ({
    periodKey: r.period_key,
    label:     formatLabel(r.period_key, level),
    count:     r.count,
    thumbnail: {
      photoId: r.thumbnail_id,
      url:     `/api/v1/photos/${r.thumbnail_id}/thumbnail?size=200`,
    },
  }));

  return apiSuccess(data, { total, hasMore, nextCursor, limit });
});
