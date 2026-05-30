import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { reviewPhoto } from '@/lib/ollama';
import { isTimeoutError } from '@/lib/ollama/client';
import { PHOTOS_PATH } from '@/lib/config';
import { getAiSearchState, updateAiSearchState } from '@/lib/aiSearchState';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (getAiSearchState().running) {
    return NextResponse.json({ error: 'Operación en curso. Espera a que termine.' }, { status: 429 });
  }

  const { photoId } = await params;
  const db = getDb();
  const pid = parseInt(photoId, 10);
  const photo = db.prepare(`
    SELECT p.path, COALESCE(c.path, ?) as catalog_path
    FROM photos p
    LEFT JOIN catalogs c ON c.id = p.catalog_id
    WHERE p.id = ?
  `).get(PHOTOS_PATH, pid) as { path: string; catalog_path: string } | undefined;
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  updateAiSearchState({ running: true, startedAt: Date.now() });
  try {
    const review = await reviewPhoto(photo.path, photo.catalog_path);
    return NextResponse.json(review);
  } catch (err) {
    const message = isTimeoutError(err)
      ? 'Ollama tardó demasiado en responder (timeout). El modelo puede estar cargando o la imagen es muy compleja.'
      : err instanceof Error ? err.message : 'Unknown error';
    console.error('[review] reviewPhoto failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    updateAiSearchState({ running: false, startedAt: null });
  }
}
