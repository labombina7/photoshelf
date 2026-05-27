import { NextRequest, NextResponse } from 'next/server';
import { withAuth, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { resolvePhotoPath, PHOTOS_PATH } from '@/lib/config';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const MIME_TYPES: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.tif':  'image/tiff',
  '.tiff': 'image/tiff',
  '.avif': 'image/avif',
};

interface Params { params: Promise<{ id: string }> }

export function GET(_req: NextRequest, { params }: Params) {
  return withAuth(async (_r, _session) => {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return apiError('BAD_REQUEST', 'Invalid photo ID', 400);

    const db = getDb();
    const photo = db.prepare(`
      SELECT p.path, p.filename, COALESCE(c.path, ?) as catalog_path
      FROM photos p
      LEFT JOIN catalogs c ON c.id = p.catalog_id
      WHERE p.id = ?
    `).get(PHOTOS_PATH, id) as { path: string; filename: string; catalog_path: string } | undefined;
    if (!photo) return apiError('NOT_FOUND', 'Photo not found', 404);

    let absPath: string;
    try {
      absPath = resolvePhotoPath(photo.path, photo.catalog_path);
    } catch {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    const exists = await fsPromises.access(absPath).then(() => true).catch(() => false);
    if (!exists) return apiError('NOT_FOUND', 'File not found on disk', 404);

    const stream = fs.createReadStream(absPath);
    const ext    = path.extname(photo.filename).toLowerCase();
    const mime   = MIME_TYPES[ext] ?? 'image/jpeg';

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        'Content-Type':        mime,
        'Cache-Control':       'private, max-age=3600',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(photo.filename)}"`,
      },
    });
  })(_req);
}
