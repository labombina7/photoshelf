import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveJob } from '@/lib/queries/jobs';
import { ensureWorkerRunning } from '@/lib/worker';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    ensureWorkerRunning();
    const job = getActiveJob();
    if (!job) {
      return NextResponse.json({ status: 'idle', running: false, pending: false, year: null, done: 0, total: 0, error: null, jobId: null });
    }
    const payload = JSON.parse(job.payload) as { year?: number; event?: string };
    return NextResponse.json({
      status: job.status,
      running: job.status === 'in_progress',
      pending: job.status === 'pending',
      year: payload.year ?? null,
      done: job.processed,
      total: job.total,
      error: job.error_last,
      jobId: job.id,
    });
  } catch (err) {
    console.error('[classify/status] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
