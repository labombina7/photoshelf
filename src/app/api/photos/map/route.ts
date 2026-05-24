import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getMapPhotos, getMapYears, countWithGps, countPhotos } from '@/lib/queries/photos';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const yearParam = req.nextUrl.searchParams.get('year');
  const year = yearParam ? parseInt(yearParam, 10) : undefined;

  const { photos, limitReached } = getMapPhotos(year);
  const availableYears = getMapYears();
  const withGps = year !== undefined ? countWithGps(year) : countWithGps();
  const total = countPhotos();

  return NextResponse.json({ photos, total, withGps, availableYears, limitReached });
}
