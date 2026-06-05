import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getCatalogById } from '@/lib/queries/catalogs';
import { clusterPhotos } from '@/lib/albumClusterizer';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const catalogId = parseInt(id, 10);
  if (isNaN(catalogId)) return NextResponse.json({ error: 'Invalid catalog id' }, { status: 400 });

  const crossCatalog = req.nextUrl.searchParams.get('crossCatalog') !== 'false';

  try {
    const catalog = getCatalogById(catalogId);
    if (!catalog) return NextResponse.json({ error: 'Catalog not found' }, { status: 404 });

    const clusters = clusterPhotos(catalogId, crossCatalog);
    return NextResponse.json({ clusters });
  } catch (err) {
    console.error('[suggest-albums] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
