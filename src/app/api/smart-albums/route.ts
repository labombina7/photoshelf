import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { listSmartAlbums, createSmartAlbum } from '@/lib/queries/smartAlbums';
import type { AlbumRule } from '@/lib/smartAlbumQuery';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const catalogId = await getActiveCatalogId();
    const albums = listSmartAlbums(catalogId);
    return NextResponse.json({ albums });
  } catch (err) {
    console.error('[smart-albums] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as { name?: string; rules?: AlbumRule[] };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const catalogId = await getActiveCatalogId();
    const id = createSmartAlbum(body.name.trim(), body.rules ?? [], catalogId);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error('[smart-albums] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
