import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';

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
    const db = getDb();

    const tags = (
      db.prepare('SELECT name FROM tags ORDER BY name ASC').all() as { name: string }[]
    ).map(r => r.name);

    const events = (
      db
        .prepare(
          `SELECT DISTINCT event FROM photos
           WHERE event IS NOT NULL AND event != ''
           ORDER BY event ASC`,
        )
        .all() as { event: string }[]
    ).map(r => r.event);

    return NextResponse.json({ tags, events });
  } catch (err) {
    console.error('[search/hints] Error fetching hints:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
