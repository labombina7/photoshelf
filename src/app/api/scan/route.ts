import { NextResponse } from 'next/server';
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

  updateScanState({ running: true, done: 0, total: 0, currentEvent: 'Iniciando…', error: null, completedAt: null });

  // Fire and forget — scan runs in background, client polls /api/scan/status
  scanLibrary(catalog.path, (event, done, total) => {
    updateScanState({ currentEvent: event, done, total });
  }, catalogId).then(() => {
    updateScanState({ running: false, completedAt: Date.now() });
  }).catch((err: Error) => {
    updateScanState({ running: false, error: err.message, completedAt: Date.now() });
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
