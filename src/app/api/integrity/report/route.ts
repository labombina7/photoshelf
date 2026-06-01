import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getIntegrityReport, getIntegrityReportMeta } from '@/lib/queries/integrity';
import { getIntegrityState } from '@/lib/integrityState';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const meta = getIntegrityReportMeta();
    const items = getIntegrityReport();
    const state = getIntegrityState();

    return NextResponse.json({
      meta,
      items,
      lastRunState: {
        phase: state.phase,
        completedAt: state.completedAt,
        error: state.error,
      },
    });
  } catch (err) {
    console.error('[integrity/report] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
