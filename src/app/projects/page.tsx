import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getDb, getSidebarProjects } from '@/lib/db';
import ProjectsClient from './ProjectsClient';
import type { Theme } from '@/lib/types';

export default async function ProjectsPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const db = getDb();

  const projects = db.prepare(`
    SELECT pr.id, pr.title, pr.statement, pr.scope_type, pr.scope_value, pr.created_at,
           COUNT(pp.photo_id) as photo_count,
           (SELECT pp2.photo_id FROM project_photos pp2 WHERE pp2.project_id = pr.id ORDER BY pp2.position ASC LIMIT 1) as cover_photo_id
    FROM projects pr
    LEFT JOIN project_photos pp ON pp.project_id = pr.id
    GROUP BY pr.id
    ORDER BY pr.created_at DESC
  `).all() as {
    id: number; title: string; statement: string;
    scope_type: string; scope_value: string | null;
    created_at: string; photo_count: number; cover_photo_id: number | null;
  }[];

  const total = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;
  const favoriteCount = (db.prepare('SELECT COUNT(*) as c FROM photos WHERE is_favorite = 1').get() as { c: number }).c;
  const untaggedCount = (db.prepare('SELECT COUNT(*) as c FROM photos p WHERE NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id)').get() as { c: number }).c;

  const themes = db.prepare(`
    SELECT th.id, th.name, th.color, COUNT(pt.photo_id) as photo_count
    FROM themes th LEFT JOIN photo_themes pt ON pt.theme_id = th.id
    GROUP BY th.id ORDER BY th.name ASC
  `).all() as Theme[];

  const years = (db.prepare('SELECT DISTINCT year FROM photos ORDER BY year DESC').all() as { year: number }[]).map(r => r.year);

  const events = db.prepare('SELECT DISTINCT year, event FROM photos ORDER BY year DESC, event ASC').all() as { year: number; event: string }[];
  const sidebarProjects = getSidebarProjects(db);

  return (
    <ProjectsClient
      projects={projects}
      sidebarProjects={sidebarProjects}
      themes={themes}
      years={years}
      events={events}
      totalPhotos={total}
      favoriteCount={favoriteCount}
      untaggedCount={untaggedCount}
    />
  );
}
