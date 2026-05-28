import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getCatalogById } from '@/lib/queries/catalogs';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { catalogId } = await req.json() as { catalogId?: number };
    if (!catalogId || typeof catalogId !== 'number') {
      return NextResponse.json({ error: 'catalogId es obligatorio' }, { status: 400 });
    }

    const catalog = getCatalogById(catalogId);
    if (!catalog) return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 });

    session.catalogId = catalogId;
    await session.save();

    return NextResponse.json({ catalog });
  } catch (err) {
    console.error('[catalogs/switch] Error switching catalog:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
