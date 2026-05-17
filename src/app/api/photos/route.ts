import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const year = sp.get('year');
  const event = sp.get('event');
  const theme = sp.get('theme');
  const tag = sp.get('tag');
  const favorite = sp.get('favorite');
  const q = sp.get('q');
  const page = parseInt(sp.get('page') ?? '1', 10);
  const limit = parseInt(sp.get('limit') ?? '200', 10);
  const offset = (page - 1) * limit;

  let sql = `
    SELECT DISTINCT p.*
    FROM photos p
    ${theme ? 'JOIN photo_themes pt2 ON pt2.photo_id = p.id AND pt2.theme_id = ?' : ''}
    ${tag ? 'JOIN photo_tags ptg ON ptg.photo_id = p.id JOIN tags tg ON tg.id = ptg.tag_id AND tg.name = ?' : ''}
    ${q ? 'LEFT JOIN photo_tags ptq ON ptq.photo_id = p.id LEFT JOIN tags tq ON tq.id = ptq.tag_id' : ''}
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (theme) params.unshift(parseInt(theme, 10));
  if (tag) params.push(tag);

  if (year) { sql += ' AND p.year = ?'; params.push(parseInt(year, 10)); }
  if (event) { sql += ' AND p.event = ?'; params.push(event); }
  if (favorite) { sql += ' AND p.is_favorite = 1'; }
  if (q) {
    sql += ' AND (p.filename LIKE ? OR p.event LIKE ? OR tq.name LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  sql += ' ORDER BY p.taken_at DESC, p.filename ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const photos = db.prepare(sql).all(...params);

  // Attach tags to each photo
  const tagStmt = db.prepare(
    'SELECT t.name, pt.source FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.photo_id = ?'
  );
  const withTags = (photos as Record<string, unknown>[]).map((p) => ({
    ...p,
    tags: tagStmt.all(p.id as number),
  }));

  // Stats
  const total = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;
  const years = (db.prepare('SELECT DISTINCT year FROM photos ORDER BY year DESC').all() as { year: number }[]).map(r => r.year);

  return NextResponse.json({ photos: withTags, total, years });
}
