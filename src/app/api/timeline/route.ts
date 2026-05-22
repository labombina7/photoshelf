import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Level = 'year' | 'month' | 'day';

interface PhotoRow {
  id: number;
  filename: string;
  taken_at: string | null;
}

interface Group {
  label: string;
  period: string;
  count: number;
  photos: PhotoRow[];
}

function getPeriodKey(takenAt: string | null, level: Level): string {
  if (!takenAt) return 'nodate';
  const d = new Date(takenAt);
  if (level === 'year') return String(d.getUTCFullYear());
  if (level === 'month') return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return takenAt.slice(0, 10); // YYYY-MM-DD
}

function formatLabel(period: string, level: Level): string {
  if (period === 'nodate') return 'Sin fecha';
  if (level === 'year') return period;
  if (level === 'month') {
    const [y, m] = period.split('-');
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }
  // day
  const [y, m, d] = period.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const level = (sp.get('level') ?? 'month') as Level;
  const cursor = sp.get('cursor') ?? null;  // ISO date string — exclusive upper bound (desc order)
  const limit = Math.min(parseInt(sp.get('limit') ?? '60', 10), 120);

  if (!['year', 'month', 'day'].includes(level)) {
    return NextResponse.json({ error: 'Invalid level' }, { status: 400 });
  }

  const db = getDb();

  // We fetch limit+1 to detect hasMore
  let rows: PhotoRow[];
  if (cursor) {
    rows = db.prepare(`
      SELECT id, filename, taken_at
      FROM photos
      WHERE (taken_at IS NULL OR taken_at < ?)
      ORDER BY taken_at DESC NULLS LAST, created_at DESC
      LIMIT ?
    `).all(cursor, limit + 1) as PhotoRow[];
  } else {
    rows = db.prepare(`
      SELECT id, filename, taken_at
      FROM photos
      ORDER BY taken_at DESC NULLS LAST, created_at DESC
      LIMIT ?
    `).all(limit + 1) as PhotoRow[];
  }

  const hasMore = rows.length > limit;
  if (hasMore) rows = rows.slice(0, limit);

  // Group by period
  const groupMap = new Map<string, Group>();
  const groupOrder: string[] = [];

  for (const row of rows) {
    const period = getPeriodKey(row.taken_at, level);
    if (!groupMap.has(period)) {
      groupMap.set(period, {
        label: formatLabel(period, level),
        period,
        count: 0,
        photos: [],
      });
      groupOrder.push(period);
    }
    const g = groupMap.get(period)!;
    g.photos.push({ id: row.id, filename: row.filename, taken_at: row.taken_at });
    g.count++;
  }

  // Move 'nodate' to end
  const sorted = groupOrder
    .filter(p => p !== 'nodate')
    .concat(groupOrder.includes('nodate') ? ['nodate'] : [])
    .map(p => groupMap.get(p)!);

  // Next cursor: taken_at of the last dated photo in the batch
  let nextCursor: string | null = null;
  if (hasMore) {
    const lastDated = [...rows].reverse().find(r => r.taken_at !== null);
    nextCursor = lastDated?.taken_at ?? null;
  }

  return NextResponse.json({ groups: sorted, nextCursor, hasMore });
}
