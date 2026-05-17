import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photoId } = await params;
  const { name, source = 'manual' } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const db = getDb();
  const tagName = name.trim().toLowerCase();

  // Upsert tag
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tagName);
  const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName) as { id: number };

  // Insert photo_tag (ignore if duplicate)
  db.prepare(
    'INSERT OR IGNORE INTO photo_tags (photo_id, tag_id, source) VALUES (?, ?, ?)'
  ).run(parseInt(photoId, 10), tag.id, source);

  return NextResponse.json({ ok: true, id: tag.id, name: tagName, source });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photoId } = await params;
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const db = getDb();
  db.prepare(`
    DELETE FROM photo_tags
    WHERE photo_id = ?
    AND tag_id = (SELECT id FROM tags WHERE name = ? COLLATE NOCASE)
  `).run(parseInt(photoId, 10), name);

  return NextResponse.json({ ok: true });
}
