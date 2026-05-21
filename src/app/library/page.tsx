import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getDb, getSidebarProjects } from '@/lib/db';
import LibraryClient from './LibraryClient';

interface SearchParams {
  year?: string;
  event?: string;
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

  // If no year/event/filter is active, default to the current year (if photos exist for it)
  if (!sp.year && !sp.event && !sp.theme && !sp.favorite && !sp.untagged && !sp.q) {
    const currentYear = new Date().getFullYear();
    const hasCurrentYear = db.prepare('SELECT 1 FROM photos WHERE year = ? LIMIT 1').get(currentYear);
    if (hasCurrentYear) {
      redirect(`/library?year=${currentYear}`);
    }
  }

  let groupSql = `
    SELECT p.year, p.event, COUNT(DISTINCT p.id) as count, MIN(p.id) as thumbnail_id
    FROM photos p
    ${sp.theme ? 'JOIN photo_themes pth ON pth.photo_id = p.id AND pth.theme_id = ?' : ''}
    ${sp.untagged ? 'LEFT JOIN photo_tags ptg ON ptg.photo_id = p.id' : ''}
    ${sp.q ? 'LEFT JOIN photo_tags ptq ON ptq.photo_id = p.id LEFT JOIN tags tq ON tq.id = ptq.tag_id' : ''}
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (sp.theme) params.push(parseInt(sp.theme, 10));
  if (sp.year) { groupSql += ' AND p.year = ?'; params.push(parseInt(sp.year, 10)); }
  if (sp.event) { groupSql += ' AND p.event = ?'; params.push(sp.event); }
  if (sp.favorite) { groupSql += ' AND p.is_favorite = 1'; }
  if (sp.untagged) { groupSql += ' AND ptg.photo_id IS NULL'; }
  if (sp.q) {
    groupSql += ' AND (p.filename LIKE ? OR p.event LIKE ? OR tq.name LIKE ?)';
    const like = `%${sp.q}%`;
    params.push(like, like, like);
  }

  groupSql += ' GROUP BY p.year, p.event ORDER BY p.year DESC, p.event ASC';

  const groups = db.prepare(groupSql).all(...params) as { year: number; event: string; count: number; thumbnail_id: number }[];
  const filteredTotal = groups.reduce((sum, g) => sum + g.count, 0);

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

  const projects = getSidebarProjects(db);

  return (
    <LibraryClient
      groups={groups}
      total={total}
      filteredTotal={filteredTotal}
      years={years}
      themes={themes}
      favoriteCount={favoriteCount}
      untaggedCount={untaggedCount}
      activeYear={sp.year ?? null}
      activeFilters={{ year: sp.year, event: sp.event, theme: sp.theme, favorite: sp.favorite, untagged: sp.untagged, q: sp.q }}
      projects={projects}
    />
  );
}
