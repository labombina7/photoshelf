import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { computeHealthMetrics, computeScore, saveHealthSnapshot } from '@/lib/queries/health';
import { getActiveCatalogId } from '@/lib/catalog-context';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const catalogId = await getActiveCatalogId();
    const metrics = computeHealthMetrics(catalogId);
    const score = computeScore(metrics);
    saveHealthSnapshot(score, metrics);

    return NextResponse.json({
      score,
      computed_at: new Date().toISOString(),
      metrics,
    });
  } catch (err) {
    console.error('[health] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
