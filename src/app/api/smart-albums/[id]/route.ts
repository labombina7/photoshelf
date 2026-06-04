import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { getSmartAlbumById, updateSmartAlbum, deleteSmartAlbum } from '@/lib/queries/smartAlbums';
import type { AlbumRule } from '@/lib/smartAlbumQuery';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const album = getSmartAlbumById(parseInt(id, 10));
  if (!album) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    return NextResponse.json({ album });
  } catch (err) {
    console.error('[smart-albums/id] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const album = getSmartAlbumById(parseInt(id, 10));
  if (!album) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const body = await req.json() as { name?: string; rules?: AlbumRule[] };
    updateSmartAlbum(parseInt(id, 10), body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[smart-albums/id] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const album = getSmartAlbumById(parseInt(id, 10));
  if (!album) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    deleteSmartAlbum(parseInt(id, 10));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[smart-albums/id] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
