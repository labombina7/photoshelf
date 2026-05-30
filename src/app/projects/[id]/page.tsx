import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { getSidebarProjects } from '@/lib/queries/projects';
import ProjectDetailClient from './ProjectDetailClient';
import type { Theme } from '@/lib/types';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const { id } = await params;
  const db = getDb();
  const pid = parseInt(id, 10);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid) as {
    id: number; title: string; statement: string;
    scope_type: string; scope_value: string | null; created_at: string;
  } | undefined;
  if (!project) notFound();

  const photos = db.prepare(`
    SELECT p.id, p.filename, p.year, p.event, p.taken_at, pp.position
    FROM project_photos pp JOIN photos p ON p.id = pp.photo_id
    WHERE pp.project_id = ? ORDER BY pp.position ASC
  `).all(pid) as { id: number; filename: string; year: number; event: string; taken_at: string | null; position: number }[];

  const total = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;
  const favoriteCount = (db.prepare('SELECT COUNT(*) as c FROM photos WHERE is_favorite = 1').get() as { c: number }).c;
  const untaggedCount = (db.prepare('SELECT COUNT(*) as c FROM photos p WHERE NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id)').get() as { c: number }).c;

  const themes = db.prepare(`
    SELECT th.id, th.name, th.color, COUNT(pt.photo_id) as photo_count
    FROM themes th LEFT JOIN photo_themes pt ON pt.theme_id = th.id
    GROUP BY th.id ORDER BY th.name ASC
  `).all() as Theme[];

  const sidebarProjects = getSidebarProjects();

  return (
    <ProjectDetailClient
      project={{ ...project, photos }}
      themes={themes}
      projects={sidebarProjects}
      totalPhotos={total}
      favoriteCount={favoriteCount}
      untaggedCount={untaggedCount}
    />
  );
}
