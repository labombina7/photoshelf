import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listPhotos } from '@/lib/queries/photos';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const catalogId = session.catalogId ?? 1;

  const sp       = req.nextUrl.searchParams;
  const year     = sp.get('year');
  const event    = sp.get('event');
  const theme    = sp.get('theme');
  const tag      = sp.get('tag');
  const favorite = sp.get('favorite');
  const untagged = sp.get('untagged');
  const q        = sp.get('q');
  const page     = parseInt(sp.get('page')  ?? '1',   10);
  const limit    = parseInt(sp.get('limit') ?? '200', 10);
  const offset   = (page - 1) * limit;

  const { photos, total, years } = listPhotos(
    { year, event, theme, tag, favorite, untagged, q, catalogId },
    { limit, offset },
  );

  return NextResponse.json({ photos, total, years });
}
