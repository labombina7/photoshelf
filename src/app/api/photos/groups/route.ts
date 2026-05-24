import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { buildPhotoFilter } from '@/lib/db-helpers';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const year     = sp.get('year');
  const theme    = sp.get('theme');
  const favorite = sp.get('favorite');
  const untagged = sp.get('untagged');
  const q        = sp.get('q');

  const { joinSql, whereSql, params: filterParams } = buildPhotoFilter({ year, theme, favorite, untagged, q });

  const sql = `
    SELECT p.year, p.event, COUNT(DISTINCT p.id) as count
    FROM photos p
    ${joinSql}
    WHERE 1=1
    ${whereSql}
    GROUP BY p.year, p.event ORDER BY p.year DESC, p.event ASC
  `;

  const groups = db.prepare(sql).all(...filterParams) as { year: number; event: string; count: number }[];
  const total = groups.reduce((sum, g) => sum + g.count, 0);

  return NextResponse.json({ groups, total });
}
