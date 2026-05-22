import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getDb, getSidebarProjects } from '@/lib/db';
import TagPhotosClient from './TagPhotosClient';

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const { tag: encodedTag } = await params;
  const tagName = decodeURIComponent(encodedTag);

  const db = getDb();

  // Verify tag exists
  const tagRow = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(tagName) as { id: number } | undefined;
  if (!tagRow) notFound();

  // Groups (year/event) that have at least one photo with this tag
  const groups = db.prepare(`
    SELECT p.year, p.event, COUNT(DISTINCT p.id) AS count, MIN(p.id) AS thumbnail_id
    FROM photos p
    JOIN photo_tags pt ON pt.photo_id = p.id
    WHERE pt.tag_id = ?
    GROUP BY p.year, p.event
    ORDER BY p.year DESC, p.event ASC
  `).all(tagRow.id) as { year: number; event: string; count: number; thumbnail_id: number }[];

  const total = groups.reduce((s, g) => s + g.count, 0);

  const sidebarTotal = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;
  const favoriteCount = (db.prepare('SELECT COUNT(*) as c FROM photos WHERE is_favorite = 1').get() as { c: number }).c;
  const untaggedCount = (db.prepare('SELECT COUNT(*) as c FROM photos p WHERE NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id)').get() as { c: number }).c;

  const themes = db.prepare(`
    SELECT th.id, th.name, th.color, COUNT(pt.photo_id) as photo_count
    FROM themes th LEFT JOIN photo_themes pt ON pt.theme_id = th.id
    GROUP BY th.id ORDER BY th.name ASC
  `).all() as { id: number; name: string; color: string; photo_count: number }[];

  const projects = getSidebarProjects(db);

  return (
    <TagPhotosClient
      tagName={tagName}
      groups={groups}
      total={total}
      themes={themes}
      projects={projects}
      totalPhotos={sidebarTotal}
      favoriteCount={favoriteCount}
      untaggedCount={untaggedCount}
    />
  );
}
