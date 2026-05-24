import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getMapPhotos, countPhotos } from '@/lib/queries/photos';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const photos = getMapPhotos();
  const total  = countPhotos();

  return NextResponse.json({ photos, total, withGps: photos.length });
}
