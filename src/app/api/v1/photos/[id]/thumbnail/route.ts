import { NextRequest, NextResponse } from 'next/server';
import { withAuth, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { getThumbnail } from '@/lib/thumbnail';
import { PHOTOS_PATH } from '@/lib/config';

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

    const size = parseInt(req.nextUrl.searchParams.get('size') ?? '400', 10);
    const fit  = req.nextUrl.searchParams.get('fit') === 'inside' ? 'inside' : 'cover';

    try {
      const { buffer, contentType } = await getThumbnail(photo.path, photo.catalog_path, size, fit);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type':  contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
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
