import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withAuth, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { getThumbnail } from '@/lib/thumbnail';
import { PHOTOS_PATH, normalizeThumbnailSize } from '@/lib/config';

export const dynamic = 'force-dynamic';

interface Params { params: Promise<{ id: string }> }

export function GET(req: NextRequest, { params }: Params) {
  return withAuth(async (_req, _session) => {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return apiError('BAD_REQUEST', 'Invalid photo ID', 400);

    const db = getDb();
    const photo = db.prepare(`
      SELECT p.path, COALESCE(c.path, ?) as catalog_path
      FROM photos p
      LEFT JOIN catalogs c ON c.id = p.catalog_id
      WHERE p.id = ?
    `).get(PHOTOS_PATH, id) as { path: string; catalog_path: string } | undefined;
    if (!photo) return apiError('NOT_FOUND', 'Photo not found', 404);

    const size = normalizeThumbnailSize(req.nextUrl.searchParams.get('size'));
    const fit  = req.nextUrl.searchParams.get('fit') === 'inside' ? 'inside' : 'cover';

    try {
      const { buffer, contentType } = await getThumbnail(photo.path, photo.catalog_path, size, fit);
      const etag = `"${crypto.createHash('md5').update(`${photo.catalog_path}:${photo.path}:${size}:${fit}`).digest('hex')}"`;
      if (req.headers.get('if-none-match') === etag) {
        return new NextResponse(null, { status: 304, headers: { ETag: etag } });
      }
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type':  contentType,
          'Cache-Control': 'public, max-age=604800, must-revalidate',
          'ETag':          etag,
        },
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'Path traversal detected') {
        return apiError('FORBIDDEN', 'Access denied', 403);
      }
      return apiError('INTERNAL_ERROR', 'Failed to generate thumbnail', 500);
    }
  })(req);
}
