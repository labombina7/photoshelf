import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { classifyPhoto } from '@/lib/ollama';

const PHOTOS_PATH = process.env.PHOTOS_PATH ?? '/photos';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photoId } = await params;
  const db = getDb();
  const pid = parseInt(photoId, 10);

  const photo = db.prepare('SELECT path FROM photos WHERE id = ?').get(pid) as { path: string } | undefined;
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const tags = await classifyPhoto(photo.path, PHOTOS_PATH);

  // Upsert AI tags
  const insertTag = db.transaction(() => {
    for (const name of tags) {
      db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name);
      const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: number };
      db.prepare('INSERT OR IGNORE INTO photo_tags (photo_id, tag_id, source) VALUES (?, ?, ?)').run(pid, tag.id, 'ai');
    }
  });
  insertTag();

  return NextResponse.json({ tags });
}
