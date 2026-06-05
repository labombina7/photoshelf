import { NextRequest, NextResponse, after } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { classifyPhoto } from '@/lib/ollama';
import { getClassifyState, updateClassifyState } from '@/lib/classifyState';
import { PHOTOS_PATH, CLASSIFY_BATCH_SIZE } from '@/lib/config';
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

  const { year, force } = await req.json();
  if (!year) return NextResponse.json({ error: 'year is required' }, { status: 400 });

  const catalogId = session.catalogId ?? 1;
  const catalog = getCatalogById(catalogId);
  const photosRoot = catalog?.path ?? PHOTOS_PATH;

  const db = getDb();

  const photosSql = force
    ? `SELECT p.id, p.path, p.event FROM photos p WHERE p.year = ? AND p.catalog_id = ? ORDER BY p.event ASC, p.filename ASC`
    : `SELECT p.id, p.path, p.event FROM photos p WHERE p.year = ? AND p.catalog_id = ? AND NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id AND pt.source = 'ai') ORDER BY p.event ASC, p.filename ASC`;

  const photos = db.prepare(photosSql).all(parseInt(year, 10), catalogId) as { id: number; path: string; event: string }[];

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

  // after() keeps the execution context alive after the 202 response is sent,
  // preventing Next.js from aborting the classification mid-run.
  after(async () => {
    let done = 0;
    let errors = 0;
    const deleteAiTags = db.prepare(`DELETE FROM photo_tags WHERE photo_id = ? AND source = 'ai'`);
    try {
      for (let i = 0; i < photos.length; i += CLASSIFY_BATCH_SIZE) {
        const batch = photos.slice(i, i + CLASSIFY_BATCH_SIZE);
        updateClassifyState({ currentEvent: batch[0].event, done });
        const results = await Promise.allSettled(
          batch.map(async (photo) => {
            if (force) deleteAiTags.run(photo.id);
            const tags = await classifyPhoto(photo.path, photosRoot);
            upsertAiTags(db, photo.id, tags);
          })
        );
        for (const result of results) {
          if (result.status === 'fulfilled') {
            done++;
          } else {
            errors++;
            const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
            console.error(`[classify/year] error in batch starting at ${i}:`, msg);
            if (errors === 1) updateClassifyState({ firstError: msg });
            updateClassifyState({ errors });
            done++;
          }
        }
        updateClassifyState({ done });
      }
      updateClassifyState({ running: false, completedAt: Date.now() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[classify/year] unexpected error in background task:', msg);
      updateClassifyState({ running: false, error: msg, completedAt: Date.now() });
    }
  });

  return NextResponse.json({ ok: true, total: photos.length }, { status: 202 });
}
