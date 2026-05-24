import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getPhotoById, setFavorite } from '@/lib/queries/photos';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const photo = getPhotoById(parseInt(id, 10));
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(photo);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { is_favorite } = await req.json();
  setFavorite(parseInt(id, 10), !!is_favorite);
  return NextResponse.json({ ok: true });
}
