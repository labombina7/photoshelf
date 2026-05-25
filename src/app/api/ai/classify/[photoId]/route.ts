import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { classifyPhoto } from '@/lib/ollama';
import { PHOTOS_PATH } from '@/lib/config';
import { upsertAiTags } from '@/lib/db-helpers';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photoId } = await params;
  const db = getDb();
  const pid = parseInt(photoId, 10);

  const photo = db.prepare(`
    SELECT p.path, COALESCE(c.path, ?) as catalog_path
    FROM photos p
    LEFT JOIN catalogs c ON c.id = p.catalog_id
    WHERE p.id = ?
  `).get(PHOTOS_PATH, pid) as { path: string; catalog_path: string } | undefined;
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const tags = await classifyPhoto(photo.path, photo.catalog_path);
  upsertAiTags(db, pid, tags);

  return NextResponse.json({ tags });
}
