import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createShareToken, listActiveShareTokens } from '@/lib/queries/share';
import { getPhotoPathById } from '@/lib/queries/photos';
import { SHARE_MAX_PHOTOS } from '@/lib/config';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as { photoIds?: number[]; albumId?: number; label?: string };
    const { photoIds, albumId, label } = body;

    if (!photoIds && albumId === undefined) {
      return NextResponse.json({ error: 'photoIds or albumId required' }, { status: 400 });
    }

    let ids: number[] = photoIds ?? [];

    if (albumId !== undefined) {
      // Import here to avoid circular dependency issues
      const { getSmartAlbumById, getSmartAlbumPhotos } = await import('@/lib/queries/smartAlbums');
      const { rulesFromJson } = await import('@/lib/smartAlbumQuery');
      const album = getSmartAlbumById(albumId);
      if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 });
      const catalogId = session.catalogId ?? 1;
      const rules = rulesFromJson(album.rules);
      const { rows } = getSmartAlbumPhotos(rules, catalogId, SHARE_MAX_PHOTOS);
      ids = rows.map((p: { id: number }) => p.id);
    }

    if (ids.length === 0) return NextResponse.json({ error: 'No photos selected' }, { status: 400 });
    if (ids.length > SHARE_MAX_PHOTOS) {
      return NextResponse.json({ error: `Maximum ${SHARE_MAX_PHOTOS} photos per share` }, { status: 400 });
    }

    // Validate all photo IDs exist
    for (const id of ids) {
      const photo = getPhotoPathById(id);
      if (!photo) return NextResponse.json({ error: `Photo ${id} not found` }, { status: 404 });
    }

    const shareToken = createShareToken(ids, label);
    const host = req.headers.get('host') ?? 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') ?? 'http';
    const url = `${protocol}://${host}/share/${shareToken.token}`;

    return NextResponse.json({
      token: shareToken.token,
      url,
      expiresAt: new Date(shareToken.expires_at * 1000).toISOString(),
      photoCount: ids.length,
    });
  } catch (err) {
    console.error('[share] Error creating share token:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const tokens = listActiveShareTokens();
    return NextResponse.json({ tokens });
  } catch (err) {
    console.error('[share] Error listing share tokens:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
