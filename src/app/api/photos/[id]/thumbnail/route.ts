import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { getThumbnail } from '@/lib/thumbnail';

const PHOTOS_PATH = process.env.PHOTOS_PATH ?? '/photos';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const photo = db.prepare('SELECT path FROM photos WHERE id = ?').get(parseInt(id, 10)) as { path: string } | undefined;
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const size = parseInt(req.nextUrl.searchParams.get('size') ?? '400', 10);
  const fit = req.nextUrl.searchParams.get('fit') === 'inside' ? 'inside' : 'cover';

  try {
    const { buffer, contentType } = await getThumbnail(photo.path, PHOTOS_PATH, size, fit);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
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
