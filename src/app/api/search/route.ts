import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { executeSearch } from '@/lib/search/execute';

/**
 * GET /api/search?q={query}&catalog={id}
 *
 * Unified search endpoint. Uses the heuristic classifier (US-029) to decide
 * the strategy: year / tag / event / fulltext / ai.
 * `catalog` is optional — defaults to the active catalog in session.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q')?.trim() ?? '';
  if (!q) return NextResponse.json({ error: 'Query required' }, { status: 400 });

  const catalogParam = searchParams.get('catalog');
  const catalogId = catalogParam ? parseInt(catalogParam, 10) : await getActiveCatalogId();
  const forceAI = searchParams.get('mode') === 'ai';

  try {
    const result = await executeSearch(q, catalogId, forceAI);
    return NextResponse.json({ data: result, meta: { duration_ms: result.duration_ms } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[search] Error executing search:', message);
    // Surface Ollama errors clearly; generic 500 for everything else
    if (message.includes('ECONNREFUSED') || message.includes('model') || message.includes('ollama')) {
      return NextResponse.json({ error: `IA no disponible: ${message}` }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
