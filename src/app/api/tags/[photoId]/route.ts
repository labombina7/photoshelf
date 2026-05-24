import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { addTagToPhoto, removeTagFromPhoto } from '@/lib/queries/tags';

export async function POST(req: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photoId } = await params;
  const { name, source = 'manual' } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const tag = addTagToPhoto(parseInt(photoId, 10), name, source);
  return NextResponse.json({ ok: true, ...tag });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photoId } = await params;
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  removeTagFromPhoto(parseInt(photoId, 10), name);
  return NextResponse.json({ ok: true });
}
