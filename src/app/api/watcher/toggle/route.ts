import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { setWatcherEnabled } from '@/lib/folderWatcher';
import { getWatcherState } from '@/lib/watcherState';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { enabled } = await req.json() as { enabled: boolean };
    setWatcherEnabled(enabled);
    return NextResponse.json(getWatcherState());
  } catch (err) {
    console.error('[watcher/toggle] Error toggling watcher:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
