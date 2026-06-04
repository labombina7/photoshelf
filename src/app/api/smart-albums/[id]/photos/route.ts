import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { getSmartAlbumById, getSmartAlbumPhotos } from '@/lib/queries/smartAlbums';
import { rulesFromJson } from '@/lib/smartAlbumQuery';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const album = getSmartAlbumById(parseInt(id, 10));
  if (!album) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const catalogId = await getActiveCatalogId();
    const cursor = req.nextUrl.searchParams.get('cursor') ?? null;
    const rules = rulesFromJson(album.rules);
    const result = getSmartAlbumPhotos(rules, catalogId, 120, cursor);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[smart-albums/id/photos] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
