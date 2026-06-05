import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listJobs } from '@/lib/queries/jobs';
import { ensureWorkerRunning } from '@/lib/worker';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    ensureWorkerRunning();
    return NextResponse.json({ jobs: listJobs(30) });
  } catch (err) {
    console.error('[jobs] Error listing jobs:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
