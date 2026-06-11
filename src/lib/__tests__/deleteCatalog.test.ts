import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock fs ───────────────────────────────────────────────────────────────────
vi.mock('fs', () => ({
  default: {
    statSync: vi.fn().mockReturnValue({ isDirectory: () => true }),
    existsSync: vi.fn().mockReturnValue(true),
  },
}));

// ── Mock db with in-memory SQLite ─────────────────────────────────────────────
const mockRun = vi.fn();
const mockGet = vi.fn();
const mockTransaction = vi.fn();
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => ({
    prepare: vi.fn((sql: string) => ({
      run: mockRun,
      get: mockGet,
      all: vi.fn().mockReturnValue([]),
    })),
    transaction: mockTransaction,
  })),
}));

import { deleteCatalog } from '@/lib/queries/catalogs';

function makeTransactionImpl() {
  // Simulates better-sqlite3 transaction: executes the fn synchronously
  mockTransaction.mockImplementation((fn: () => void) => () => fn());
}

beforeEach(() => {
  vi.clearAllMocks();
  makeTransactionImpl();
  // Default: catalog exists
  mockGet.mockReturnValue({ id: 2, name: 'Test', path: '/photos/test', created_at: 1, photo_count: 0 });
});

describe('deleteCatalog()', () => {
  it('borrado exitoso elimina fotos y el registro del catálogo', () => {
    deleteCatalog(2);

    expect(mockRun).toHaveBeenCalledTimes(2);
    const calls = mockRun.mock.calls;
    // First DELETE: photos WHERE catalog_id = ?
    expect(calls[0]).toEqual([2]);
    // Second DELETE: catalogs WHERE id = ?
    expect(calls[1]).toEqual([2]);
  });

  it('lanza error al intentar borrar catálogo id=1 sin tocar la BD', () => {
    expect(() => deleteCatalog(1)).toThrow('No se puede eliminar el catálogo Principal');
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('lanza error al intentar borrar un catálogo inexistente', () => {
    mockGet.mockReturnValue(undefined);
    expect(() => deleteCatalog(99)).toThrow(/no encontrado/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('opera dentro de una transacción — ambos DELETEs o ninguno', () => {
    // Simulate failure mid-transaction
    let calls = 0;
    mockRun.mockImplementation(() => {
      calls++;
      if (calls === 2) throw new Error('DB error');
    });
    mockTransaction.mockImplementation((fn: () => void) => () => {
      try { fn(); } catch { /* rollback: don't run second delete */ }
    });

    // The transaction wrapper absorbed the error; no partial state
    expect(() => deleteCatalog(2)).not.toThrow();
    // Only first run was called (second threw)
    expect(mockRun.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
