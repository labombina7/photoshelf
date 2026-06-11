import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock fs (sync) ────────────────────────────────────────────────────────────
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
  },
}));

// ── Mock integrityState ───────────────────────────────────────────────────────
const mockGetIntegrityState = vi.fn(() => ({ running: false }));
const mockUpdateIntegrityState = vi.fn();
vi.mock('@/lib/integrityState', () => ({
  getIntegrityState: () => mockGetIntegrityState(),
  updateIntegrityState: (...args: unknown[]) => mockUpdateIntegrityState(...args),
}));

// ── Mock queries/integrity ────────────────────────────────────────────────────
const mockClearReports = vi.fn();
const mockInsertReport = vi.fn();
const mockGetAllPhotoPaths = vi.fn().mockReturnValue([]);
const mockGetIndexedPathsSet = vi.fn().mockReturnValue(new Set<string>());
vi.mock('@/lib/queries/integrity', () => ({
  clearIntegrityReports: () => mockClearReports(),
  insertIntegrityReport: (...args: unknown[]) => mockInsertReport(...args),
  getAllPhotoPaths: () => mockGetAllPhotoPaths(),
  getIndexedPathsSet: () => mockGetIndexedPathsSet(),
}));

// ── Mock config ───────────────────────────────────────────────────────────────
vi.mock('@/lib/config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config');
  return { ...actual, PHOTOS_PATH: '/photos' };
});

import fs from 'fs';
import { runIntegrityScan } from '@/lib/integrityScanner';

const mockFs = vi.mocked(fs);

type Dirent = { name: string; isDirectory: () => boolean; isFile: () => boolean };

function makeDirent(name: string, isDir = false): Dirent {
  return { name, isDirectory: () => isDir, isFile: () => !isDir };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetIntegrityState.mockReturnValue({ running: false });
  mockFs.readdirSync.mockReturnValue([]);
});

describe('runIntegrityScan()', () => {
  it('clasifica como orphan una foto en BD que no existe en disco', async () => {
    mockGetAllPhotoPaths.mockReturnValue([{ id: 1, path: '2024/test.jpg' }]);
    mockFs.existsSync.mockReturnValue(false);
    mockGetIndexedPathsSet.mockReturnValue(new Set(['2024/test.jpg']));

    await runIntegrityScan();

    expect(mockInsertReport).toHaveBeenCalledWith('orphan', '2024/test.jpg', 1);
  });

  it('clasifica como unindexed un fichero en disco que no está en BD', async () => {
    mockGetAllPhotoPaths.mockReturnValue([]);
    mockGetIndexedPathsSet.mockReturnValue(new Set());
    mockFs.existsSync.mockReturnValue(true);
    // Walk: /photos → [2024/], /photos/2024 → [photo.jpg]
    mockFs.readdirSync.mockImplementation((dir: fs.PathLike | string) => {
      if (String(dir) === '/photos') return [makeDirent('2024', true)] as unknown as ReturnType<typeof fs.readdirSync>;
      return [makeDirent('photo.jpg')] as unknown as ReturnType<typeof fs.readdirSync>;
    });

    await runIntegrityScan();

    expect(mockInsertReport).toHaveBeenCalledWith('unindexed', '2024/photo.jpg');
  });

  it('ignora ficheros con extensión no soportada', async () => {
    mockGetAllPhotoPaths.mockReturnValue([]);
    mockGetIndexedPathsSet.mockReturnValue(new Set());
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockImplementation((dir: fs.PathLike | string) => {
      if (String(dir) === '/photos') return [makeDirent('2024', true)] as unknown as ReturnType<typeof fs.readdirSync>;
      return [makeDirent('thumbs.db'), makeDirent('readme.txt')] as unknown as ReturnType<typeof fs.readdirSync>;
    });

    await runIntegrityScan();

    expect(mockInsertReport).not.toHaveBeenCalled();
  });
});
