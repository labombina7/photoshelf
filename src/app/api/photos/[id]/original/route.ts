import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const PHOTOS_PATH = process.env.PHOTOS_PATH ?? '/photos';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const photo = db.prepare('SELECT path, filename FROM photos WHERE id = ?').get(parseInt(id, 10)) as { path: string; filename: string } | undefined;
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const absPath = path.join(PHOTOS_PATH, photo.path);
  if (!fs.existsSync(absPath)) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const stream = fs.createReadStream(absPath);
  const ext = path.extname(photo.filename).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
