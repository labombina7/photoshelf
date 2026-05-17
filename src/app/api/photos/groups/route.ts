import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const year = sp.get('year');
  const theme = sp.get('theme');
  const favorite = sp.get('favorite');
  const untagged = sp.get('untagged');
  const q = sp.get('q');

  let sql = `
    SELECT p.year, p.event, COUNT(DISTINCT p.id) as count
    FROM photos p
    ${theme ? 'JOIN photo_themes pth ON pth.photo_id = p.id AND pth.theme_id = ?' : ''}
    ${untagged ? 'LEFT JOIN photo_tags ptg ON ptg.photo_id = p.id' : ''}
    ${q ? 'LEFT JOIN photo_tags ptq ON ptq.photo_id = p.id LEFT JOIN tags tq ON tq.id = ptq.tag_id' : ''}
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (theme) params.push(parseInt(theme, 10));
  if (year) { sql += ' AND p.year = ?'; params.push(parseInt(year, 10)); }
  if (favorite) { sql += ' AND p.is_favorite = 1'; }
  if (untagged) { sql += ' AND ptg.photo_id IS NULL'; }
  if (q) {
    sql += ' AND (p.filename LIKE ? OR p.event LIKE ? OR tq.name LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  sql += ' GROUP BY p.year, p.event ORDER BY p.year DESC, p.event ASC';

  const groups = db.prepare(sql).all(...params) as { year: number; event: string; count: number }[];
  const total = groups.reduce((sum, g) => sum + g.count, 0);

  return NextResponse.json({ groups, total });
}
