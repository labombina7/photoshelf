import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { countSmartAlbumPhotos, rulesFromJson } from '@/lib/smartAlbumQuery';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rulesParam = req.nextUrl.searchParams.get('rules') ?? '[]';
    const rules = rulesFromJson(rulesParam);
    const catalogId = await getActiveCatalogId();
    const count = countSmartAlbumPhotos(rules, catalogId);
    return NextResponse.json({ count });
  } catch (err) {
    console.error('[smart-albums/preview] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
