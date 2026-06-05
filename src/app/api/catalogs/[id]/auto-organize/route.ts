import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getCatalogById } from '@/lib/queries/catalogs';
import { createAutoAlbum, deleteAutoAlbumsForCatalog } from '@/lib/queries/smartAlbums';
import type { AlbumRule } from '@/lib/smartAlbumQuery';

interface AlbumInput {
  name: string;
  rules: AlbumRule[];
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const catalogId = parseInt(id, 10);
  if (isNaN(catalogId)) return NextResponse.json({ error: 'Invalid catalog id' }, { status: 400 });

  const body = await req.json() as { albums?: AlbumInput[] };
  if (!Array.isArray(body.albums) || body.albums.length === 0) {
    return NextResponse.json({ error: 'albums array required' }, { status: 400 });
  }

  try {
    const catalog = getCatalogById(catalogId);
    if (!catalog) return NextResponse.json({ error: 'Catalog not found' }, { status: 404 });

    const created: number[] = [];
    for (const album of body.albums) {
      if (!album.name?.trim()) continue;
      const id = createAutoAlbum(album.name.trim(), album.rules, catalogId);
      created.push(id);
    }

    return NextResponse.json({ created: created.length });
  } catch (err) {
    console.error('[auto-organize] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const catalogId = parseInt(id, 10);
  if (isNaN(catalogId)) return NextResponse.json({ error: 'Invalid catalog id' }, { status: 400 });

  try {
    const catalog = getCatalogById(catalogId);
    if (!catalog) return NextResponse.json({ error: 'Catalog not found' }, { status: 404 });

    const deleted = deleteAutoAlbumsForCatalog(catalogId);
    return NextResponse.json({ deleted });
  } catch (err) {
    console.error('[auto-organize DELETE] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
