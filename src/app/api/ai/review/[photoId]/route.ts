import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { reviewPhoto } from '@/lib/ollama';

const PHOTOS_PATH = process.env.PHOTOS_PATH ?? '/photos';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photoId } = await params;
  const db = getDb();
  const photo = db.prepare('SELECT path FROM photos WHERE id = ?').get(parseInt(photoId, 10)) as { path: string } | undefined;
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const review = await reviewPhoto(photo.path, PHOTOS_PATH);
  return NextResponse.json(review);
}
