import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getDb, getSidebarProjects } from '@/lib/db';
import TagsClient from './TagsClient';

export default async function TagsPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const db = getDb();

  const tags = db.prepare(`
    SELECT t.name, COUNT(pt.photo_id) AS count
    FROM tags t
    JOIN photo_tags pt ON pt.tag_id = t.id
    GROUP BY t.id
    ORDER BY count DESC, t.name ASC
  `).all() as { name: string; count: number }[];

  const total = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;
  const favoriteCount = (db.prepare('SELECT COUNT(*) as c FROM photos WHERE is_favorite = 1').get() as { c: number }).c;
  const untaggedCount = (db.prepare('SELECT COUNT(*) as c FROM photos p WHERE NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id)').get() as { c: number }).c;

  const themes = db.prepare(`
    SELECT th.id, th.name, th.color, COUNT(pt.photo_id) as photo_count
    FROM themes th LEFT JOIN photo_themes pt ON pt.theme_id = th.id
    GROUP BY th.id ORDER BY th.name ASC
  `).all() as { id: number; name: string; color: string; photo_count: number }[];

  const projects = getSidebarProjects(db);

  return (
    <TagsClient
      tags={tags}
      themes={themes}
      projects={projects}
      totalPhotos={total}
      favoriteCount={favoriteCount}
      untaggedCount={untaggedCount}
    />
  );
}
