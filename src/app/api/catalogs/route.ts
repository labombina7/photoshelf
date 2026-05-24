import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listCatalogs, createCatalog } from '@/lib/queries/catalogs';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const catalogs = listCatalogs();
  return NextResponse.json({ catalogs });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, path } = await req.json() as { name?: string; path?: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  }
  if (name.trim().length > 100) {
    return NextResponse.json({ error: 'El nombre no puede superar 100 caracteres' }, { status: 400 });
  }
  if (!path?.trim()) {
    return NextResponse.json({ error: 'La ruta es obligatoria' }, { status: 400 });
  }

  try {
    const catalog = createCatalog({ name: name.trim(), path: path.trim() });
    return NextResponse.json({ catalog }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al crear el catálogo' }, { status: 400 });
  }
}
