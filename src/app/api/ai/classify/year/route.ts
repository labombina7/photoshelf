import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { createJob, hasActiveJobForYear } from '@/lib/queries/jobs';
import { ensureWorkerRunning } from '@/lib/worker';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { year, force } = await req.json();
  if (!year) return NextResponse.json({ error: 'year is required' }, { status: 400 });

  const catalogId = session.catalogId ?? 1;
  const yearInt = parseInt(year, 10);

  if (hasActiveJobForYear(yearInt, catalogId)) {
    return NextResponse.json(
      { error: 'Ya hay un job activo para este año. Espera a que termine.' },
      { status: 409 }
    );
  }

  const db = getDb();
  const countSql = force
    ? `SELECT COUNT(*) as n FROM photos WHERE year = ? AND catalog_id = ?`
    : `SELECT COUNT(*) as n FROM photos p WHERE p.year = ? AND p.catalog_id = ? AND NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id AND pt.source = 'ai')`;

  const { n: total } = db.prepare(countSql).get(yearInt, catalogId) as { n: number };

  if (total === 0) {
    return NextResponse.json({ ok: true, message: 'No hay fotos pendientes de clasificar' }, { status: 200 });
  }

  const jobId = crypto.randomUUID();
  const payload = JSON.stringify({
    type: 'classify_year',
    year: yearInt,
    force: force ?? false,
    catalogId,
    originUrl: `/library?year=${year}`,
  });

  createJob(jobId, 'classify_year', payload, total);
  ensureWorkerRunning();

  return NextResponse.json({ ok: true, jobId, total }, { status: 202 });
}
