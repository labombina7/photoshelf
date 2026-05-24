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

  const photo = db.prepare('SELECT path FROM photos WHERE id = ?').get(pid) as { path: string } | undefined;
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const tags = await classifyPhoto(photo.path, PHOTOS_PATH);
  upsertAiTags(db, pid, tags);

  return NextResponse.json({ tags });
}
