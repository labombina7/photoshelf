/**
 * US-105 — Paginación encadenada de fotos por evento.
 *
 * Lógica pura compartida entre PhotoGrid y sus tests: construcción de URLs de
 * página, fetch de una página, y decisiones de encadenado (página siguiente,
 * quedan más, append con dedupe).
 */

/** Tamaño de página del fetch contra /api/photos (el render sigue siendo incremental aparte). */
export const PHOTOS_FETCH_PAGE_SIZE = 200;

export interface PhotosPage<T> {
  photos: T[];
  total: number;
}

/** Construye la URL de una página de fotos de un evento preservando los filtros activos de la URL. */
export function buildEventPageUrl(
  currentParams: string,
  year: number,
  event: string,
  page: number,
  pageSize: number = PHOTOS_FETCH_PAGE_SIZE,
): string {
  const params = new URLSearchParams(currentParams);
  params.set('year', String(year));
  params.set('event', event);
  params.set('limit', String(pageSize));
  params.set('page', String(page));
  return `/api/photos?${params.toString()}`;
}

/** Descarga una página. Lanza si la respuesta no es ok — el caller decide cómo mostrar el error. */
export async function fetchEventPage<T>(url: string): Promise<PhotosPage<T>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error ${res.status} al cargar fotos`);
  const data = await res.json() as { photos?: T[]; total?: number };
  return { photos: data.photos ?? [], total: data.total ?? 0 };
}

/** Número de página a pedir según lo ya descargado (páginas 1-indexadas). */
export function nextPageNumber(loadedCount: number, pageSize: number = PHOTOS_FETCH_PAGE_SIZE): number {
  return Math.floor(loadedCount / pageSize) + 1;
}

/** Quedan fotos por descargar en el servidor. */
export function hasMorePhotos(loadedCount: number, total: number | null): boolean {
  return total !== null && loadedCount < total;
}

/**
 * Añade una página deduplicando por id: la paginación por offset puede solapar
 * si la BD cambió entre páginas (fotos nuevas o borradas durante el scroll).
 */
export function appendPage<T extends { id: number }>(prev: T[], next: T[]): T[] {
  const seen = new Set(prev.map(p => p.id));
  const fresh = next.filter(p => !seen.has(p.id));
  return fresh.length > 0 ? [...prev, ...fresh] : prev;
}
