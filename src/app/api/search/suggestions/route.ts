import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { getSearchSuggestions } from '@/lib/queries/search';

/**
 * GET /api/search/suggestions?q={query}&catalog={id}
 *
 * Returns matching tags (up to 5) and events (up to 3) that contain the query.
 * Used by the AppHeader autocomplete dropdown.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ data: { tags: [], events: [], smartAlbums: [], projects: [] } });

  const catalogParam = searchParams.get('catalog');
  const catalogId = catalogParam ? parseInt(catalogParam, 10) : await getActiveCatalogId();

  try {
    const { tags, events, smartAlbums, projects } = getSearchSuggestions(q, catalogId);
    return NextResponse.json({ data: { tags, events, smartAlbums, projects } });
  } catch (err) {
    console.error('[search/suggestions] Error fetching suggestions:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
