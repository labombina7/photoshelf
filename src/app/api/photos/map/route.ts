import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getMapPhotos, getMapYears, countWithGps, countPhotos } from '@/lib/queries/photos';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const catalogId = session.catalogId ?? 1;

    const yearParam = req.nextUrl.searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : undefined;

    const { photos, limitReached } = getMapPhotos(year, catalogId);
    const availableYears = getMapYears(catalogId);
    const withGps = year !== undefined ? countWithGps(year, catalogId) : countWithGps(undefined, catalogId);
    const total = countPhotos(catalogId);

    return NextResponse.json({ photos, total, withGps, availableYears, limitReached });
  } catch (err) {
    console.error('[photos/map] Error fetching map data:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
