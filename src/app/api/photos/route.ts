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
  const event    = sp.get('event');
  const theme    = sp.get('theme');
  const tag      = sp.get('tag');
  const favorite = sp.get('favorite');
  const untagged = sp.get('untagged');
  const q        = sp.get('q');
  const page     = parseInt(sp.get('page') ?? '1', 10);
  const limit    = parseInt(sp.get('limit') ?? '200', 10);
  const offset   = (page - 1) * limit;

  const { joinSql, whereSql, params: filterParams } = buildPhotoFilter({ year, event, theme, tag, favorite, untagged, q });

  const sql = `
    SELECT DISTINCT p.*
    FROM photos p
    ${joinSql}
    WHERE 1=1
    ${whereSql}
    ORDER BY p.taken_at DESC, p.filename ASC LIMIT ? OFFSET ?
  `;

  const photos = db.prepare(sql).all(...filterParams, limit, offset) as Record<string, unknown>[];

  // Attach tags — single batch query instead of N+1
  let withTags: Record<string, unknown>[];
  if (photos.length === 0) {
    withTags = [];
  } else {
    const ids = photos.map((p) => p.id as number);
    const placeholders = ids.map(() => '?').join(',');
    const tagRows = db.prepare(
      `SELECT pt.photo_id, t.name, pt.source
       FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id
       WHERE pt.photo_id IN (${placeholders})`
    ).all(...ids) as { photo_id: number; name: string; source: string }[];

    const tagMap = new Map<number, { name: string; source: string }[]>();
    for (const row of tagRows) {
      const arr = tagMap.get(row.photo_id);
      if (arr) arr.push({ name: row.name, source: row.source });
      else tagMap.set(row.photo_id, [{ name: row.name, source: row.source }]);
    }

    withTags = photos.map((p) => ({
      ...p,
      tags: tagMap.get(p.id as number) ?? [],
    }));
  }

  // Stats
  const total = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;
  const years = (db.prepare('SELECT DISTINCT year FROM photos ORDER BY year DESC').all() as { year: number }[]).map(r => r.year);

  return NextResponse.json({ photos: withTags, total, years });
}
