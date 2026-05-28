import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getScanState } from '@/lib/scanState';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(getScanState());
  } catch (err) {
    console.error('[scan/status] Error fetching scan state:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
