import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { classifyPhoto } from '@/lib/ollama';

const PHOTOS_PATH = process.env.PHOTOS_PATH ?? '/photos';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { year, event } = await req.json();
  const db = getDb();

  let sql = `
    SELECT p.id, p.path FROM photos p
    WHERE NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id AND pt.source = 'ai')
  `;
  const params: (string | number)[] = [];

  if (year) { sql += ' AND p.year = ?'; params.push(parseInt(year, 10)); }
  if (event) { sql += ' AND p.event = ?'; params.push(event); }

  sql += ' ORDER BY p.filename ASC';

  const photos = db.prepare(sql).all(...params) as { id: number; path: string }[];
  const total = photos.length;
  let processed = 0;
  let errors = 0;

  const insertTag = db.transaction((pid: number, tags: string[]) => {
    for (const name of tags) {
      db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name);
      const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: number };
      db.prepare('INSERT OR IGNORE INTO photo_tags (photo_id, tag_id, source) VALUES (?, ?, ?)').run(pid, tag.id, 'ai');
    }
  });

  for (const photo of photos) {
    try {
      const tags = await classifyPhoto(photo.path, PHOTOS_PATH);
      if (tags.length > 0) insertTag(photo.id, tags);
      processed++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ processed, total, errors });
}
