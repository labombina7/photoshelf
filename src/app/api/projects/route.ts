import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const projects = db.prepare(`
    SELECT pr.id, pr.title, pr.statement, pr.scope_type, pr.scope_value, pr.created_at,
           COUNT(pp.photo_id) as photo_count,
           MIN(pp.position) as min_pos,
           (SELECT pp2.photo_id FROM project_photos pp2 WHERE pp2.project_id = pr.id ORDER BY pp2.position ASC LIMIT 1) as cover_photo_id
    FROM projects pr
    LEFT JOIN project_photos pp ON pp.project_id = pr.id
    GROUP BY pr.id
    ORDER BY pr.created_at DESC
  `).all();

  return NextResponse.json(projects);
}
