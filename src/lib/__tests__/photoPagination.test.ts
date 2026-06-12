import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildEventPageUrl,
  fetchEventPage,
  nextPageNumber,
  hasMorePhotos,
  appendPage,
  PHOTOS_FETCH_PAGE_SIZE,
} from '@/lib/photoPagination';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

type P = { id: number };

/** Simula un servidor con `total` fotos paginadas de `pageSize` en `pageSize`. */
function serveTotal(total: number, pageSize = PHOTOS_FETCH_PAGE_SIZE) {
  mockFetch.mockImplementation((url: string) => {
    const page = parseInt(new URL(url, 'http://x').searchParams.get('page') ?? '1', 10);
    const start = (page - 1) * pageSize;
    const photos: P[] = Array.from(
      { length: Math.max(0, Math.min(pageSize, total - start)) },
      (_, i) => ({ id: start + i + 1 }),
    );
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ photos, total }) });
  });
}

describe('buildEventPageUrl', () => {
  it('preserva los filtros activos y fija year/event/limit/page', () => {
    const url = buildEventPageUrl('camera=Canon&iso_max=800', 2023, 'Boda Sara', 2);
    const params = new URL(url, 'http://x').searchParams;
    expect(params.get('camera')).toBe('Canon');
    expect(params.get('iso_max')).toBe('800');
    expect(params.get('year')).toBe('2023');
    expect(params.get('event')).toBe('Boda Sara');
    expect(params.get('limit')).toBe(String(PHOTOS_FETCH_PAGE_SIZE));
    expect(params.get('page')).toBe('2');
  });
});

describe('encadenado de páginas (3 páginas)', () => {
  it('descarga todas las fotos de un evento de 450 en 3 páginas', async () => {
    serveTotal(450);

    // Bucle de encadenado equivalente al de PhotoGrid: pedir mientras queden fotos
    let loaded: P[] = [];
    let total: number | null = null;
    do {
      const url = buildEventPageUrl('', 2023, 'Boda', nextPageNumber(loaded.length));
      const page = await fetchEventPage<P>(url);
      loaded = appendPage(loaded, page.photos);
      total = page.total;
    } while (hasMorePhotos(loaded.length, total));

    expect(mockFetch).toHaveBeenCalledTimes(3);
    const pagesRequested = mockFetch.mock.calls.map(
      ([url]) => new URL(url as string, 'http://x').searchParams.get('page'),
    );
    expect(pagesRequested).toEqual(['1', '2', '3']);
    expect(loaded).toHaveLength(450);
    expect(loaded[0].id).toBe(1);
    expect(loaded[449].id).toBe(450);
  });

  it('un evento que cabe en una página no encadena peticiones extra', async () => {
    serveTotal(120);

    const page = await fetchEventPage<P>(buildEventPageUrl('', 2023, 'Corto', 1));
    expect(page.photos).toHaveLength(120);
    expect(hasMorePhotos(page.photos.length, page.total)).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('una página con error HTTP lanza (el caller muestra reintento, no truncado silencioso)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(fetchEventPage(buildEventPageUrl('', 2023, 'Boda', 2))).rejects.toThrow('Error 500');
  });
});

describe('appendPage', () => {
  it('deduplica por id cuando el offset solapa (BD cambió entre páginas)', () => {
    const prev: P[] = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const next: P[] = [{ id: 3 }, { id: 4 }];
    expect(appendPage(prev, next).map(p => p.id)).toEqual([1, 2, 3, 4]);
  });

  it('devuelve el array original si la página no aporta fotos nuevas', () => {
    const prev: P[] = [{ id: 1 }];
    expect(appendPage(prev, [{ id: 1 }])).toBe(prev);
  });
});

describe('nextPageNumber / hasMorePhotos', () => {
  it('calcula la página siguiente según lo descargado', () => {
    expect(nextPageNumber(0)).toBe(1);
    expect(nextPageNumber(PHOTOS_FETCH_PAGE_SIZE)).toBe(2);
    expect(nextPageNumber(PHOTOS_FETCH_PAGE_SIZE * 2)).toBe(3);
  });

  it('hasMorePhotos es false sin total conocido o con todo descargado', () => {
    expect(hasMorePhotos(0, null)).toBe(false);
    expect(hasMorePhotos(450, 450)).toBe(false);
    expect(hasMorePhotos(200, 450)).toBe(true);
  });
});
