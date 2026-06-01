import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getHealthHistory } from '@/lib/queries/health';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const history = getHealthHistory();
    return NextResponse.json(history);
  } catch (err) {
    console.error('[health/history] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
