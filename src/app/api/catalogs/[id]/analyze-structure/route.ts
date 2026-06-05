import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getCatalogById } from '@/lib/queries/catalogs';
import { analyzeCatalogStructure } from '@/lib/catalogStructureAnalyzer';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const catalogId = parseInt(id, 10);
  if (isNaN(catalogId)) return NextResponse.json({ error: 'Invalid catalog id' }, { status: 400 });

  try {
    const catalog = getCatalogById(catalogId);
    if (!catalog) return NextResponse.json({ error: 'Catalog not found' }, { status: 404 });

    const analysis = analyzeCatalogStructure(catalog.path, catalogId);
    return NextResponse.json(analysis);
  } catch (err) {
    console.error('[analyze-structure] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
