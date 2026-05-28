import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getWatcherState } from '@/lib/watcherState';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(getWatcherState());
  } catch (err) {
    console.error('[watcher/status] Error fetching watcher state:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
