import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { getDb } from '@/lib/db';

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
  if (q.length < 2) return NextResponse.json({ data: { tags: [], events: [] } });

  const catalogParam = searchParams.get('catalog');
  const catalogId = catalogParam ? parseInt(catalogParam, 10) : await getActiveCatalogId();

  try {
    const db   = getDb();
    const like = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;

    const tags = db.prepare(`
      SELECT t.name, COUNT(pt.photo_id) AS count
      FROM tags t
      JOIN photo_tags pt ON pt.tag_id = t.id
      JOIN photos p ON p.id = pt.photo_id
      WHERE t.name LIKE ? ESCAPE '\\' AND p.catalog_id = ?
      GROUP BY t.id ORDER BY count DESC LIMIT 5
    `).all(like, catalogId) as { name: string; count: number }[];

    const events = db.prepare(`
      SELECT event AS name, year, COUNT(*) AS count
      FROM photos
      WHERE event LIKE ? ESCAPE '\\' AND catalog_id = ?
        AND event IS NOT NULL AND event != ''
      GROUP BY year, event ORDER BY year DESC, count DESC LIMIT 3
    `).all(like, catalogId) as { name: string; year: number; count: number }[];

    return NextResponse.json({ data: { tags, events } });
  } catch (err) {
    console.error('[search/suggestions] Error fetching suggestions:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
