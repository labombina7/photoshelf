import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createJob } from '@/lib/queries/jobs';
import { ensureWorkerRunning } from '@/lib/worker';

export const maxDuration = 300;

interface GenerateBody {
  scopeType: 'year' | 'event' | 'theme' | 'all';
  scopeValue?: string;
  count: number;
  tone?: 'b&w' | 'color';
  styles?: string[];
  tags?: string[];
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { scopeType, scopeValue, count = 15, tone, styles, tags: filterTags }: GenerateBody = await req.json();
    const catalogId = session.catalogId ?? 1;

    const jobId = crypto.randomUUID();
    const payload = JSON.stringify({
      type: 'generate_project',
      scopeType,
      scopeValue,
      count,
      tone,
      styles,
      tags: filterTags,
      catalogId,
      originUrl: '/projects',
    });

    createJob(jobId, 'generate_project', payload, 1);
    ensureWorkerRunning();

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[projects/generate] Error enqueueing job:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
