import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const pid = parseInt(id, 10);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const photos = db.prepare(`
    SELECT p.id, p.filename, p.year, p.event, p.taken_at, p.camera, pp.position
    FROM project_photos pp
    JOIN photos p ON p.id = pp.photo_id
    WHERE pp.project_id = ?
    ORDER BY pp.position ASC
  `).all(pid);

  return NextResponse.json({ ...project, photos });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const pid = parseInt(id, 10);
  const { title, statement, photoIds }: { title?: string; statement?: string; photoIds?: number[] } = await req.json();

  if (title !== undefined || statement !== undefined) {
    if (title) db.prepare('UPDATE projects SET title = ? WHERE id = ?').run(title, pid);
    if (statement !== undefined) db.prepare('UPDATE projects SET statement = ? WHERE id = ?').run(statement, pid);
  }

  if (photoIds) {
    const update = db.transaction(() => {
      db.prepare('DELETE FROM project_photos WHERE project_id = ?').run(pid);
      photoIds.forEach((photoId, pos) => {
        db.prepare('INSERT OR IGNORE INTO project_photos (project_id, photo_id, position) VALUES (?, ?, ?)').run(pid, photoId, pos);
      });
    });
    update();
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id = ?').run(parseInt(id, 10));
  return NextResponse.json({ ok: true });
}
