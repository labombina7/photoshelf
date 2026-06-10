import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getEvolutionData, getEvolutionAnalysis } from '@/lib/queries/evolution';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = getEvolutionData();
    const analysis = getEvolutionAnalysis();
    return NextResponse.json({ ...data, analysis });
  } catch (err) {
    console.error('[insights/evolution] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
