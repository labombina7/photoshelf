import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getDb, getSidebarProjects } from '@/lib/db';
import dynamic from 'next/dynamic';
import type { Theme } from '@/lib/types';

const MapClient = dynamic(() => import('./MapClient'), { ssr: false });

export default async function MapPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const db = getDb();

  const total = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;
  const withGps = (db.prepare('SELECT COUNT(*) as c FROM photos WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL').get() as { c: number }).c;
  const favoriteCount = (db.prepare('SELECT COUNT(*) as c FROM photos WHERE is_favorite = 1').get() as { c: number }).c;
  const untaggedCount = (db.prepare(`
    SELECT COUNT(*) as c FROM photos p
    WHERE NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id)
  `).get() as { c: number }).c;

  const themes = db.prepare(`
    SELECT th.id, th.name, th.color, COUNT(pt.photo_id) as photo_count
    FROM themes th LEFT JOIN photo_themes pt ON pt.theme_id = th.id
    GROUP BY th.id ORDER BY th.name ASC
  `).all() as Theme[];

  const projects = getSidebarProjects(db);

  return (
    <MapClient
      total={total}
      withGps={withGps}
      themes={themes}
      projects={projects}
      totalPhotos={total}
      favoriteCount={favoriteCount}
      untaggedCount={untaggedCount}
    />
  );
}
