import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { renameCatalog, deleteCatalog, getCatalogById } from '@/lib/queries/catalogs';
import { getActiveCatalogId } from '@/lib/catalog-context';

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const { name } = await req.json() as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  if (name.trim().length > 100) return NextResponse.json({ error: 'Nombre demasiado largo (máx 100 caracteres)' }, { status: 400 });

  try {
    const catalog = renameCatalog(id, name.trim());
    return NextResponse.json({ catalog });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al renombrar' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  if (id === 1) return NextResponse.json({ error: 'No se puede eliminar el catálogo Principal' }, { status: 400 });

  // Cannot delete the active catalog
  const activeCatalogId = await getActiveCatalogId();
  if (id === activeCatalogId) {
    return NextResponse.json({ error: 'No se puede eliminar el catálogo activo. Cambia a otro catálogo primero.' }, { status: 400 });
  }

  const catalog = getCatalogById(id);
  if (!catalog) return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 });

  try {
    deleteCatalog(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al eliminar' }, { status: 400 });
  }
}
