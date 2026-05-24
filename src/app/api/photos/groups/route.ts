import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listGroups } from '@/lib/queries/groups';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const catalogId = session.catalogId ?? 1;

  const sp       = req.nextUrl.searchParams;
  const year     = sp.get('year');
  const theme    = sp.get('theme');
  const favorite = sp.get('favorite');
  const untagged = sp.get('untagged');
  const q        = sp.get('q');

  const { groups, total } = listGroups({ year, theme, favorite, untagged, q }, catalogId);
  return NextResponse.json({ groups, total });
}
