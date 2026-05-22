import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getDb, getSidebarProjects } from '@/lib/db';
import TimelineClient from './TimelineClient';

export default async function TimelinePage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const db = getDb();

  const totalPhotos = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;
  const favoriteCount = (db.prepare('SELECT COUNT(*) as c FROM photos WHERE is_favorite = 1').get() as { c: number }).c;
  const untaggedCount = (db.prepare(`
    SELECT COUNT(*) as c FROM photos p
    WHERE NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id)
  `).get() as { c: number }).c;

  const themes = db.prepare(`
    SELECT th.id, th.name, th.color, COUNT(pt.photo_id) as photo_count
    FROM themes th LEFT JOIN photo_themes pt ON pt.theme_id = th.id
    GROUP BY th.id ORDER BY th.name ASC
  `).all() as { id: number; name: string; color: string; photo_count: number }[];

  const projects = getSidebarProjects(db);

  // Load initial block (first 60 photos, month level) server-side
  const initialRows = db.prepare(`
    SELECT id, filename, taken_at
    FROM photos
    ORDER BY taken_at DESC NULLS LAST, created_at DESC
    LIMIT 61
  `).all() as { id: number; filename: string; taken_at: string | null }[];

  const hasMore = initialRows.length > 60;
  const rows = hasMore ? initialRows.slice(0, 60) : initialRows;

  // Compute next cursor
  let nextCursor: string | null = null;
  if (hasMore) {
    const lastDated = [...rows].reverse().find(r => r.taken_at !== null);
    nextCursor = lastDated?.taken_at ?? null;
  }

  return (
    <TimelineClient
      initialRows={rows}
      initialNextCursor={nextCursor}
      initialHasMore={hasMore}
      themes={themes}
      projects={projects}
      totalPhotos={totalPhotos}
      favoriteCount={favoriteCount}
      untaggedCount={untaggedCount}
    />
  );
}
