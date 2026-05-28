import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { resolvePhotoPath, PHOTOS_PATH, MIME_TYPES, FALLBACK_MIME } from '@/lib/config';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const db = getDb();
    const photo = db.prepare(`
      SELECT p.path, p.filename, COALESCE(c.path, ?) as catalog_path
      FROM photos p
      LEFT JOIN catalogs c ON c.id = p.catalog_id
      WHERE p.id = ?
    `).get(PHOTOS_PATH, parseInt(id, 10)) as { path: string; filename: string; catalog_path: string } | undefined;
    if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Validate path is within its catalog root (path traversal protection)
    let absPath: string;
    try {
      absPath = resolvePhotoPath(photo.path, photo.catalog_path);
    } catch {
      console.error('[security] Path traversal attempt blocked for photo id:', id, 'path:', photo.path);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const exists = await fsPromises.access(absPath).then(() => true).catch(() => false);
    if (!exists) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    const stream = fs.createReadStream(absPath);
    const ext = path.extname(photo.filename).toLowerCase();
    const mime = MIME_TYPES[ext] ?? FALLBACK_MIME;

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('[original] Error serving original photo:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
