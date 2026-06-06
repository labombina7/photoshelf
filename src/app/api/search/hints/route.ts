import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { getSearchHints } from '@/lib/queries/search';

/**
 * GET /api/search/hints
 *
 * Returns the list of known tag names and event names for the active catalog.
 * Used by the AppHeader classifier to avoid unnecessary AI calls.
 */
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const catalogId = await getActiveCatalogId();
    const { tags, events, smartAlbums, projects } = getSearchHints(catalogId);
    return NextResponse.json({ tags, events, smartAlbums, projects });
  } catch (err) {
    console.error('[search/hints] Error fetching hints:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
