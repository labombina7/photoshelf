import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getIntegrityState } from '@/lib/integrityState';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const state = getIntegrityState();
    return NextResponse.json({
      running: state.running,
      phase: state.phase,
      checked: state.checked,
      total: state.total,
      orphansFound: state.orphansFound,
      unindexedFound: state.unindexedFound,
      corruptFound: state.corruptFound,
      error: state.error,
      completedAt: state.completedAt,
    });
  } catch (err) {
    console.error('[integrity/status] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
