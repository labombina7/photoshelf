import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getJob, cancelJob } from '@/lib/queries/jobs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const job = getJob(id);
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(job);
  } catch (err) {
    console.error('[jobs/id] Error fetching job:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const cancelled = cancelJob(id);
    if (!cancelled) return NextResponse.json({ error: 'Job not found or already finished' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[jobs/id] Error cancelling job:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
