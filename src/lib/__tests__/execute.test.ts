/**
 * Tests unitarios para src/lib/search/execute.ts
 *
 * Verifica:
 * 1. searchByTag no genera SQL con p.p.id (doble prefijo)
 * 2. searchAI no genera SQL con p.p.id y el ORDER BY usa alias p en ambas ramas
 * 3. executeSearch AI con Ollama caído hace fallback a fulltext (no explota)
 * 4. executeSearch devuelve resultados correctos para cada intent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/ollama', () => ({ parseSearchQuery: vi.fn() }));

import { getDb } from '@/lib/db';
import { parseSearchQuery } from '@/lib/ollama';
import { executeSearch } from '../search/execute';

const mockGetDb  = vi.mocked(getDb);
const mockParseQ = vi.mocked(parseSearchQuery);

const CATALOG_ID = 1;

/**
 * Crea un mock de db que distingue:
 *  - Queries de hints (tags catalog, events catalog)  → siempre []
 *  - Queries de búsqueda                              → photoRows
 *
 * También acumula todo el SQL que pasa por prepare() en capturedSqls.
 */
function makeDbMock(photoRows: object[] = []) {
  const capturedSqls: string[] = [];

  const db = {
    prepare: vi.fn((sql: string) => {
      capturedSqls.push(sql);
      const isHintQuery =
        // tags hint (loadHints)
        (sql.includes('FROM tags') && sql.includes('ORDER BY name')) ||
        // events hint (loadHints)
        (sql.includes('event IS NOT NULL') && sql.includes('DISTINCT')) ||
        // matchingTags (fulltext side-results)
        (sql.includes('FROM tags t') && sql.includes('LIKE')) ||
        // matchingEvents (fulltext side-results) — tiene GROUP BY year, event
        (sql.includes('GROUP BY year, event'));

      const rows = isHintQuery ? [] : photoRows;
      return { all: vi.fn(() => rows), get: vi.fn(() => rows[0]) };
    }),
    _capturedSqls: capturedSqls,
  };
  return db;
}

// ─── Tests: SQL sin doble prefijo ─────────────────────────────────────────────

describe('SQL generado — sin doble prefijo p.p.', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ninguna query tiene p.p. en una búsqueda fulltext', async () => {
    const db = makeDbMock();
    mockGetDb.mockReturnValue(db as ReturnType<typeof getDb>);

    await executeSearch('algo generico', CATALOG_ID);

    for (const sql of db._capturedSqls) {
      expect(sql, `SQL no debe contener "p.p.": "${sql}"`).not.toMatch(/\bp\.p\./);
    }
  });

  it('searchAI (tags branch) — el SELECT usa p.id, p.filename… sin doble prefijo', async () => {
    mockParseQ.mockResolvedValue({ year: null, concept: 'perros', tags: ['perro'] });

    const db = makeDbMock();
    mockGetDb.mockReturnValue(db as ReturnType<typeof getDb>);

    await executeSearch('fotos de perros', CATALOG_ID, true);

    const aiQuery = db._capturedSqls.find(s => s.includes('photo_tags'));
    expect(aiQuery, 'debe haber una query con JOIN photo_tags').toBeDefined();
    expect(aiQuery!).not.toMatch(/\bp\.p\./);
    expect(aiQuery!).toMatch(/SELECT\s+p\.id/);   // primer campo correcto
  });

  it('searchAI (year-only branch) — FROM photos p y ORDER BY p.taken_at', async () => {
    mockParseQ.mockResolvedValue({ year: 2020, concept: '2020', tags: [] });

    const db = makeDbMock();
    mockGetDb.mockReturnValue(db as ReturnType<typeof getDb>);

    await executeSearch('fotos del verano pasado', CATALOG_ID, true);

    // Query de fotos reales (sin hints, sin event IS NOT NULL, sin LIKE para events)
    const photoQuery = db._capturedSqls.find(s =>
      s.includes('FROM photos p') &&
      !s.includes('event IS NOT NULL') &&
      !s.includes('event LIKE')
    );
    expect(photoQuery, 'debe existir query con FROM photos p').toBeDefined();
    expect(photoQuery!).not.toMatch(/\bp\.p\./);
    expect(photoQuery!).toMatch(/ORDER BY p\.taken_at/);
  });
});

// ─── Tests: resultados correctos ──────────────────────────────────────────────

describe('executeSearch — intent fulltext', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve fotos vacías cuando la BD no tiene resultados', async () => {
    const db = makeDbMock([]);
    mockGetDb.mockReturnValue(db as ReturnType<typeof getDb>);

    const result = await executeSearch('algo generico', CATALOG_ID);

    expect(result.intent).toBe('fulltext');
    expect(result.photos).toEqual([]);
    expect(result.isAI).toBe(false);
  });

  it('devuelve las filas que retorna la BD', async () => {
    const fakePhotos = [
      { id: 1, filename: 'foto1.jpg', year: 2023, event: 'vacaciones', taken_at: null, is_favorite: 0 },
    ];
    const db = makeDbMock(fakePhotos);
    mockGetDb.mockReturnValue(db as ReturnType<typeof getDb>);

    const result = await executeSearch('vacaciones', CATALOG_ID);

    expect(result.intent).toBe('fulltext');
    expect(result.photos).toEqual(fakePhotos);
    expect(result.total).toBe(1);
  });
});

describe('executeSearch — intent year', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clasifica "2022" como year', async () => {
    const db = makeDbMock([]);
    mockGetDb.mockReturnValue(db as ReturnType<typeof getDb>);

    const result = await executeSearch('2022', CATALOG_ID);

    expect(result.intent).toBe('year');
    expect(result.isAI).toBe(false);
  });
});

// ─── Tests: búsqueda IA (Ollama disponible) ───────────────────────────────────

describe('executeSearch — intent AI con Ollama disponible', () => {
  beforeEach(() => vi.clearAllMocks());

  it('isAI=true y llama a parseSearchQuery', async () => {
    mockParseQ.mockResolvedValue({ year: null, concept: 'perros', tags: ['perro'] });

    const db = makeDbMock([]);
    mockGetDb.mockReturnValue(db as ReturnType<typeof getDb>);

    const result = await executeSearch('fotos de perros corriendo', CATALOG_ID, true);

    expect(result.isAI).toBe(true);
    expect(mockParseQ).toHaveBeenCalledWith('fotos de perros corriendo');
  });

  it('devuelve las fotos que retorna la BD', async () => {
    mockParseQ.mockResolvedValue({ year: null, concept: 'perros', tags: ['perro'] });

    const fakePhotos = [
      { id: 5, filename: 'perro.jpg', year: 2021, event: 'jardín', taken_at: null, is_favorite: 0 },
    ];
    const db = makeDbMock(fakePhotos);
    mockGetDb.mockReturnValue(db as ReturnType<typeof getDb>);

    const result = await executeSearch('fotos de perros', CATALOG_ID, true);

    expect(result.photos).toEqual(fakePhotos);
    expect(result.total).toBe(1);
  });

  it('aiConcept se incluye cuando el concepto difiere de la query', async () => {
    mockParseQ.mockResolvedValue({ year: null, concept: 'fotografías de perros', tags: ['perro'] });

    const db = makeDbMock([]);
    mockGetDb.mockReturnValue(db as ReturnType<typeof getDb>);

    const result = await executeSearch('perros', CATALOG_ID, true);

    // 'fotografías de perros' !== 'perros' → debe aparecer aiConcept
    expect(result.aiConcept).toBe('fotografías de perros');
  });

  it('aiConcept es undefined cuando el concepto coincide con la query', async () => {
    mockParseQ.mockResolvedValue({ year: null, concept: 'perros', tags: ['perro'] });

    const db = makeDbMock([]);
    mockGetDb.mockReturnValue(db as ReturnType<typeof getDb>);

    const result = await executeSearch('perros', CATALOG_ID, true);

    expect(result.aiConcept).toBeUndefined();
  });
});

// ─── Tests: búsqueda IA con Ollama caído ─────────────────────────────────────

describe('executeSearch — intent AI con Ollama caído', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no lanza excepción si parseSearchQuery falla (ECONNREFUSED)', async () => {
    mockParseQ.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434'));

    const db = makeDbMock([]);
    mockGetDb.mockReturnValue(db as ReturnType<typeof getDb>);

    await expect(
      executeSearch('qué fotos tengo de cumpleaños', CATALOG_ID, true)
    ).resolves.not.toThrow();
  });

  it('isAI=false en el fallback (Ollama caído)', async () => {
    mockParseQ.mockRejectedValue(new Error('timeout'));

    const db = makeDbMock([]);
    mockGetDb.mockReturnValue(db as ReturnType<typeof getDb>);

    const result = await executeSearch('qué fotos tengo de verano', CATALOG_ID, true);

    expect(result.isAI).toBe(false);
  });

  it('devuelve objeto SearchResult completo incluso con Ollama caído', async () => {
    mockParseQ.mockRejectedValue(new Error('model not found'));

    const db = makeDbMock([]);
    mockGetDb.mockReturnValue(db as ReturnType<typeof getDb>);

    const result = await executeSearch('fotos con niños jugando', CATALOG_ID, true);

    expect(result).toMatchObject({
      isAI: false,
      photos: expect.any(Array),
      tags: expect.any(Array),
      events: expect.any(Array),
      total: expect.any(Number),
      duration_ms: expect.any(Number),
    });
  });
});
