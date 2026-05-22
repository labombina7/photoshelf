import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { setWatcherEnabled } from '@/lib/folderWatcher';
import { getWatcherState } from '@/lib/watcherState';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { enabled } = await req.json() as { enabled: boolean };
  setWatcherEnabled(enabled);
  return NextResponse.json(getWatcherState());
}
