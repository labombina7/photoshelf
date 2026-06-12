import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '@/lib/session';
import { getPhotoPathById } from '@/lib/queries/photos';
import { getThumbnail } from '@/lib/thumbnail';
import { normalizeThumbnailSize } from '@/lib/config';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const photo = getPhotoPathById(parseInt(id, 10));
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const size = normalizeThumbnailSize(req.nextUrl.searchParams.get('size'));
  const fit = req.nextUrl.searchParams.get('fit') === 'inside' ? 'inside' : 'cover';

  try {
    const { buffer, contentType } = await getThumbnail(photo.path, photo.catalog_path, size, fit);
    const etag = `"${crypto.createHash('md5').update(`${photo.catalog_path}:${photo.path}:${size}:${fit}`).digest('hex')}"`;
    if (req.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, must-revalidate',
        'ETag': etag,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Path traversal detected') {
      console.error('[security] Path traversal attempt blocked for photo id:', id);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    console.error('Thumbnail error:', err);
    return NextResponse.json({ error: 'Failed to generate thumbnail' }, { status: 500 });
  }
}
