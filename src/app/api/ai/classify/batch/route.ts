import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { PHOTOS_PATH, CLASSIFY_BATCH_SIZE } from '@/lib/config';
import { getCatalogById } from '@/lib/queries/catalogs';
import { createJob } from '@/lib/queries/jobs';
import { ensureWorkerRunning } from '@/lib/worker';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { year, event, force } = await req.json();
  const catalogId = session.catalogId ?? 1;
  const catalog = getCatalogById(catalogId);
  const photosRoot = catalog?.path ?? PHOTOS_PATH;

  const db = getDb();

  let countSql = `SELECT COUNT(*) as n FROM photos p WHERE p.catalog_id = ?`;
  const params: (string | number)[] = [catalogId];
  if (!force) {
    countSql += ` AND NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id AND pt.source = 'ai')`;
  }
  if (year)  { countSql += ' AND p.year = ?';  params.push(parseInt(year, 10)); }
  if (event) { countSql += ' AND p.event = ?'; params.push(event); }

  const { n: total } = db.prepare(countSql).get(...params) as { n: number };

  if (total === 0) {
    return NextResponse.json({ processed: 0, total: 0, errors: 0 });
  }

  const jobId = crypto.randomUUID();
  const payload = JSON.stringify({
    type: 'classify_batch',
    year: year ? parseInt(year, 10) : undefined,
    event: event ?? undefined,
    force: force ?? false,
    catalogId,
    photosRoot,
    originUrl: year && event ? `/library?year=${year}&event=${encodeURIComponent(event)}` : '/library',
  });

  createJob(jobId, 'classify_batch', payload, total);
  ensureWorkerRunning();

  // Return batch size so PhotoGrid can calculate progress increments
  return NextResponse.json({ jobId, total, batchSize: CLASSIFY_BATCH_SIZE }, { status: 202 });
}
