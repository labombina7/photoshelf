import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getBootstrapProgress, getLatestProfiles } from '@/lib/queries/style-analysis';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const bootstrapProgress = getBootstrapProgress();
    const annualProfiles = getLatestProfiles(20, 'annual_historical');
    const monthlyProfiles = getLatestProfiles(24, 'monthly');

    return NextResponse.json({ bootstrapProgress, annualProfiles, monthlyProfiles });
  } catch (err) {
    console.error('[api/insights] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
