import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { classifyPhoto } from '@/lib/ollama';
import { PHOTOS_PATH, CLASSIFY_BATCH_SIZE } from '@/lib/config';
import { upsertAiTags } from '@/lib/db-helpers';
import { getCatalogById } from '@/lib/queries/catalogs';
import { getClassifyState, updateClassifyState } from '@/lib/classifyState';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (getClassifyState().running) {
    return NextResponse.json(
      { error: 'Hay una clasificación en curso. Espera a que termine.' },
      { status: 409 }
    );
  }

  const { year, event, force } = await req.json();
  const catalogId = session.catalogId ?? 1;
  const catalog = getCatalogById(catalogId);
  const photosRoot = catalog?.path ?? PHOTOS_PATH;

  const db = getDb();

  let sql = `SELECT p.id, p.path FROM photos p WHERE p.catalog_id = ?`;
  if (!force) {
    sql += ` AND NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id AND pt.source = 'ai')`;
  }
  const params: (string | number)[] = [catalogId];

  if (year) { sql += ' AND p.year = ?'; params.push(parseInt(year, 10)); }
  if (event) { sql += ' AND p.event = ?'; params.push(event); }

  sql += ' ORDER BY p.filename ASC';

  const photos = db.prepare(sql).all(...params) as { id: number; path: string }[];
  const total = photos.length;

  if (total === 0) {
    return NextResponse.json({ processed: 0, total: 0, errors: 0 });
  }

  updateClassifyState({
    running: true,
    year: year ? parseInt(year, 10) : null,
    currentEvent: event ?? '',
    done: 0,
    total,
    errors: 0,
    firstError: null,
    error: null,
    completedAt: null,
  });

  let processed = 0;
  let errors = 0;
  let firstError: string | null = null;

  const deleteAiTags = db.prepare(`
    DELETE FROM photo_tags WHERE photo_id = ? AND source = 'ai'
  `);

  for (let i = 0; i < photos.length; i += CLASSIFY_BATCH_SIZE) {
    const batch = photos.slice(i, i + CLASSIFY_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (photo) => {
        if (force) deleteAiTags.run(photo.id);
        const tags = await classifyPhoto(photo.path, photosRoot);
        upsertAiTags(db, photo.id, tags);
      })
    );
    for (const result of results) {
      if (result.status === 'fulfilled') {
        processed++;
      } else {
        errors++;
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error(`[classify/batch] error in batch starting at ${i}:`, msg);
        if (!firstError) { firstError = msg; updateClassifyState({ firstError: msg }); }
        updateClassifyState({ errors });
      }
    }
    updateClassifyState({ done: processed + errors });
  }

  updateClassifyState({ running: false, completedAt: Date.now() });

  return NextResponse.json({ processed, total, errors, firstError });
}
