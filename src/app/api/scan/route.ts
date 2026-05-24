import { NextResponse, after } from 'next/server';
import { getSession } from '@/lib/session';
import { scanLibrary } from '@/lib/scanner';
import { getScanState, updateScanState } from '@/lib/scanState';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { getCatalogById } from '@/lib/queries/catalogs';

export const maxDuration = 300;

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (getScanState().running) {
    return NextResponse.json(
      { error: 'Hay un análisis en curso. Espera a que termine antes de iniciar otro.' },
      { status: 409 }
    );
  }

  const catalogId = await getActiveCatalogId();
  const catalog = getCatalogById(catalogId);
  if (!catalog) {
    return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 });
  }

  console.log(`[scan] Iniciando escaneo — catálogo ${catalogId} "${catalog.name}" → ${catalog.path}`);

  updateScanState({ running: true, done: 0, total: 0, currentEvent: 'Iniciando…', error: null, completedAt: null });

  // after() keeps the execution context alive after the 202 response is sent,
  // so the async scan is not aborted by the Next.js runtime.
  after(async () => {
    try {
      const result = await scanLibrary(catalog.path, (event, done, total) => {
        updateScanState({ currentEvent: event, done, total });
      }, catalogId);
      console.log(`[scan] Completado — añadidas: ${result.added}, total: ${result.total}`);
      updateScanState({ running: false, completedAt: Date.now() });
    } catch (err) {
      console.error('[scan] Error:', err);
      updateScanState({ running: false, error: (err as Error).message, completedAt: Date.now() });
    }
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
