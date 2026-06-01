import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getIntegrityState } from '@/lib/integrityState';
import { runIntegrityScan } from '@/lib/integrityScanner';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (getIntegrityState().running) {
    return NextResponse.json({ error: 'Integrity scan already running' }, { status: 409 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const includeCorrupt = Boolean(body?.includeCorrupt);

    // Run in background — do not await
    runIntegrityScan(includeCorrupt).catch(err =>
      console.error('[integrity/scan] Unhandled error:', err)
    );

    return NextResponse.json({ started: true });
  } catch (err) {
    console.error('[integrity/scan] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
