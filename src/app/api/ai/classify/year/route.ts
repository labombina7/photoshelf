import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { classifyPhoto } from '@/lib/ollama';
import { getClassifyState, updateClassifyState } from '@/lib/classifyState';
import { PHOTOS_PATH } from '@/lib/config';
import { upsertAiTags } from '@/lib/db-helpers';
import { getCatalogById } from '@/lib/queries/catalogs';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (getClassifyState().running) {
    return NextResponse.json(
      { error: 'Hay una clasificación en curso. Espera a que termine antes de iniciar otra.' },
      { status: 409 }
    );
  }

  const { year } = await req.json();
  if (!year) return NextResponse.json({ error: 'year is required' }, { status: 400 });

  const catalogId = session.catalogId ?? 1;
  const catalog = getCatalogById(catalogId);
  const photosRoot = catalog?.path ?? PHOTOS_PATH;

  const db = getDb();

  // Fetch all unclassified photos for the year in the active catalog
  const photos = db.prepare(`
    SELECT p.id, p.path, p.event
    FROM photos p
    WHERE p.year = ?
      AND p.catalog_id = ?
      AND NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id AND pt.source = 'ai')
    ORDER BY p.event ASC, p.filename ASC
  `).all(parseInt(year, 10), catalogId) as { id: number; path: string; event: string }[];

  if (photos.length === 0) {
    return NextResponse.json({ ok: true, message: 'No hay fotos pendientes de clasificar' }, { status: 200 });
  }

  updateClassifyState({
    running: true,
    year: parseInt(year, 10),
    currentEvent: '',
    done: 0,
    total: photos.length,
    errors: 0,
    firstError: null,
    error: null,
    completedAt: null,
  });

  // Fire and forget — classify in background
  (async () => {
    let done = 0;
    let errors = 0;
    for (const photo of photos) {
      updateClassifyState({ currentEvent: photo.event, done });
      try {
        const tags = await classifyPhoto(photo.path, photosRoot);
        upsertAiTags(db, photo.id, tags);
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[classify] error on photo ${photo.id} (${photo.path}):`, msg);
        // Save first error to state so the UI can surface it
        if (errors === 1) updateClassifyState({ firstError: msg });
        updateClassifyState({ errors });
      }
      done++;
      updateClassifyState({ done });
    }
    updateClassifyState({ running: false, completedAt: Date.now() });
  })().catch((err: Error) => {
    updateClassifyState({ running: false, error: err.message, completedAt: Date.now() });
  });

  return NextResponse.json({ ok: true, total: photos.length }, { status: 202 });
}
