import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { resolvePhotoPath, PHOTOS_PATH } from '@/lib/config';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.avif': 'image/avif',
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const photo = db.prepare('SELECT path, filename FROM photos WHERE id = ?').get(parseInt(id, 10)) as { path: string; filename: string } | undefined;
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Validate path is within PHOTOS_PATH (path traversal protection)
  let absPath: string;
  try {
    absPath = resolvePhotoPath(photo.path, PHOTOS_PATH);
  } catch {
    console.error('[security] Path traversal attempt blocked for photo id:', id, 'path:', photo.path);
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const exists = await fsPromises.access(absPath).then(() => true).catch(() => false);
  if (!exists) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const stream = fs.createReadStream(absPath);
  const ext = path.extname(photo.filename).toLowerCase();
  const mime = MIME_TYPES[ext] ?? 'image/jpeg';

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
