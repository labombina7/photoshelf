import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listGroups } from '@/lib/queries/groups';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const catalogId = session.catalogId ?? 1;

    const sp       = req.nextUrl.searchParams;
    const year     = sp.get('year');
    const theme    = sp.get('theme');
    const favorite = sp.get('favorite');
    const untagged = sp.get('untagged');
    const q        = sp.get('q');

    const { groups, total } = listGroups({ year, theme, favorite, untagged, q }, catalogId);
    return NextResponse.json({ groups, total });
  } catch (err) {
    console.error('[photos/groups] Error listing groups:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
