import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import LibraryClient from './LibraryClient';

interface SearchParams {
  year?: string;
  theme?: string;
  favorite?: string;
  untagged?: string;
  q?: string;
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const sp = await searchParams;
  const db = getDb();

  // Build photo query
  let sql = `
    SELECT DISTINCT p.*
    FROM photos p
    ${sp.theme ? 'JOIN photo_themes pth ON pth.photo_id = p.id AND pth.theme_id = ?' : ''}
    ${sp.untagged ? 'LEFT JOIN photo_tags ptg ON ptg.photo_id = p.id' : ''}
    ${sp.q ? 'LEFT JOIN photo_tags ptq ON ptq.photo_id = p.id LEFT JOIN tags tq ON tq.id = ptq.tag_id' : ''}
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (sp.theme) params.push(parseInt(sp.theme, 10));
  if (sp.year) { sql += ' AND p.year = ?'; params.push(parseInt(sp.year, 10)); }
  if (sp.favorite) { sql += ' AND p.is_favorite = 1'; }
  if (sp.untagged) { sql += ' AND ptg.photo_id IS NULL'; }
  if (sp.q) {
    sql += ' AND (p.filename LIKE ? OR p.event LIKE ? OR tq.name LIKE ?)';
    const like = `%${sp.q}%`;
    params.push(like, like, like);
  }

  const countSql = sql.replace('SELECT DISTINCT p.*', 'SELECT COUNT(DISTINCT p.id) as c');
  const filteredTotal = (db.prepare(countSql).get(...params) as { c: number }).c;

  sql += ' ORDER BY p.year DESC, p.event ASC, p.taken_at DESC, p.filename ASC LIMIT 500';

  const photos = db.prepare(sql).all(...params) as Record<string, unknown>[];

  // Attach tags
  const tagStmt = db.prepare(
    'SELECT t.name, pt.source FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.photo_id = ?'
  );
  const withTags = photos.map((p) => ({ ...p, tags: tagStmt.all(p.id as number) }));

  // Meta
  const total = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;
  const years = (db.prepare('SELECT DISTINCT year FROM photos ORDER BY year DESC').all() as { year: number }[]).map(r => r.year);
  const favoriteCount = (db.prepare('SELECT COUNT(*) as c FROM photos WHERE is_favorite = 1').get() as { c: number }).c;
  const untaggedCount = (db.prepare('SELECT COUNT(*) as c FROM photos p WHERE NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id)').get() as { c: number }).c;

  const themes = db.prepare(`
    SELECT th.id, th.name, th.color, COUNT(pt.photo_id) as photo_count
    FROM themes th
    LEFT JOIN photo_themes pt ON pt.theme_id = th.id
    GROUP BY th.id ORDER BY th.name ASC
  `).all() as { id: number; name: string; color: string; photo_count: number }[];

  return (
    <LibraryClient
      photos={withTags as Parameters<typeof LibraryClient>[0]['photos']}
      total={total}
      filteredTotal={filteredTotal}
      years={years}
      themes={themes}
      favoriteCount={favoriteCount}
      untaggedCount={untaggedCount}
      activeYear={sp.year ?? null}
    />
  );
}
