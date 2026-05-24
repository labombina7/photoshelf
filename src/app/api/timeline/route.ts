import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getTimelineRows } from '@/lib/queries/timeline';

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
  if (level === 'year')  return String(d.getUTCFullYear());
  if (level === 'month') return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return takenAt.slice(0, 10); // YYYY-MM-DD
}

function formatLabel(period: string, level: Level): string {
  if (period === 'nodate') return 'Sin fecha';
  if (level === 'year')  return period;
  if (level === 'month') {
    const [y, m] = period.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }
  const [y, m, d] = period.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp     = req.nextUrl.searchParams;
  const level  = (sp.get('level') ?? 'month') as Level;
  const cursor = sp.get('cursor') ?? null;
  const limit  = Math.min(parseInt(sp.get('limit') ?? '60', 10), 120);

  if (!['year', 'month', 'day'].includes(level)) {
    return NextResponse.json({ error: 'Invalid level' }, { status: 400 });
  }

  const { rows, hasMore, nextCursor } = getTimelineRows(limit, cursor);

  // Group by period
  const groupMap   = new Map<string, Group>();
  const groupOrder: string[] = [];

  for (const row of rows) {
    const period = getPeriodKey(row.taken_at, level);
    if (!groupMap.has(period)) {
      groupMap.set(period, { label: formatLabel(period, level), period, count: 0, photos: [] });
      groupOrder.push(period);
    }
    const g = groupMap.get(period)!;
    g.photos.push({ id: row.id, filename: row.filename, taken_at: row.taken_at });
    g.count++;
  }

  const sorted = groupOrder
    .filter(p => p !== 'nodate')
    .concat(groupOrder.includes('nodate') ? ['nodate'] : [])
    .map(p => groupMap.get(p)!);

  return NextResponse.json({ groups: sorted, nextCursor, hasMore });
}
