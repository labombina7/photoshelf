import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { isAmplitudeConfigured } from '@/lib/amplitude';
import { getAmplitudeSyncProgress } from '@/lib/queries/amplitude';
import { syncPendingPhotosToAmplitude } from '@/lib/amplitude-sync';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const configured = isAmplitudeConfigured();
    const progress = getAmplitudeSyncProgress();
    return NextResponse.json({ configured, ...progress });
  } catch (err) {
    console.error('[amplitude/sync] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAmplitudeConfigured()) {
    return NextResponse.json({ error: 'AMPLITUDE_API_KEY not configured' }, { status: 400 });
  }

  try {
    const { total, synced } = getAmplitudeSyncProgress();
    const pending = total - synced;

    // Fire and forget — runs in background
    syncPendingPhotosToAmplitude().catch(err =>
      console.error('[amplitude/sync] Background sync error:', err)
    );

    return NextResponse.json({ started: true, pending });
  } catch (err) {
    console.error('[amplitude/sync] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
