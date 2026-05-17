import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(parseInt(id, 10));
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const tags = db.prepare(
    'SELECT t.id, t.name, pt.source FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.photo_id = ?'
  ).all(parseInt(id, 10));

  const themes = db.prepare(`
    SELECT th.id, th.name, th.color
    FROM photo_themes pt
    JOIN themes th ON th.id = pt.theme_id
    WHERE pt.photo_id = ?
  `).all(parseInt(id, 10));

  return NextResponse.json({ ...photo, tags, themes });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { is_favorite } = await req.json();
  const db = getDb();
  db.prepare('UPDATE photos SET is_favorite = ? WHERE id = ?').run(is_favorite ? 1 : 0, parseInt(id, 10));
  return NextResponse.json({ ok: true });
}
