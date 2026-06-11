import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock fs (sync) ────────────────────────────────────────────────────────────
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    accessSync: vi.fn(),
    writeFileSync: vi.fn(),
    statSync: vi.fn(),
    readdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    constants: { W_OK: 2 },
  },
}));

// ── Mock getDb ────────────────────────────────────────────────────────────────
const mockExec = vi.fn();
const mockAll = vi.fn().mockReturnValue([]);
const mockPrepare = vi.fn().mockReturnValue({ all: mockAll });
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => ({ exec: mockExec, prepare: mockPrepare })),
}));

// ── Mock queries/backup ───────────────────────────────────────────────────────
vi.mock('@/lib/queries/backup', () => ({
  updateLastBackup: vi.fn(),
}));

// ── Mock config ───────────────────────────────────────────────────────────────
vi.mock('@/lib/config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config');
  return { ...actual, BACKUP_PATH: '/data/backups', BACKUP_MAX_KEEP: 2 };
});

import fs from 'fs';
import { runBackup } from '@/lib/backup';
import { BACKUP_PATH } from '@/lib/config';

const mockFs = vi.mocked(fs);

beforeEach(() => {
  vi.clearAllMocks();
  mockFs.existsSync.mockReturnValue(true);
  mockFs.accessSync.mockImplementation(() => undefined);
  mockFs.statSync.mockReturnValue({ size: 1024, mtimeMs: Date.now() } as ReturnType<typeof fs.statSync>);
  mockFs.readdirSync.mockReturnValue([]);
});

describe('runBackup()', () => {
  it('crea el fichero .db y el .json en BACKUP_PATH', async () => {
    const result = await runBackup();

    expect(mockFs.writeFileSync).toHaveBeenCalledOnce();
    const [jsonPath, jsonContent] = mockFs.writeFileSync.mock.calls[0] as [string, string, string];
    expect(jsonPath).toContain(BACKUP_PATH);
    expect(jsonPath).toMatch(/-tags\.json$/);
    expect(result.db_path).toContain(BACKUP_PATH);
    expect(result.db_path).toMatch(/\.db$/);
    expect(result.json_path).toMatch(/-tags\.json$/);

    const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
    expect(parsed).toHaveProperty('photo_tags');
    expect(parsed).toHaveProperty('photo_themes');
    expect(parsed).toHaveProperty('projects');
    expect(parsed).toHaveProperty('favorites');
  });

  it('lanza error si BACKUP_PATH no tiene permisos de escritura', async () => {
    mockFs.accessSync.mockImplementation(() => { throw new Error('EACCES'); });

    await expect(runBackup()).rejects.toThrow(/permisos de escritura/);
  });

  it('la rotación elimina el fichero más antiguo cuando se supera BACKUP_MAX_KEEP', async () => {
    const files = [
      { name: 'photoshelf-2024-01-03-120000.db', mtimeMs: 3000 },
      { name: 'photoshelf-2024-01-02-120000.db', mtimeMs: 2000 },
      { name: 'photoshelf-2024-01-01-120000.db', mtimeMs: 1000 }, // oldest → to delete
    ];
    mockFs.readdirSync.mockReturnValue(files.map(f => f.name) as unknown as ReturnType<typeof fs.readdirSync>);
    mockFs.statSync.mockImplementation((p: fs.PathLike) => {
      const name = String(p).split('/').pop()!;
      const f = files.find(x => x.name === name || String(p).endsWith(x.name));
      return { size: 1024, mtimeMs: f?.mtimeMs ?? 1000 } as ReturnType<typeof fs.statSync>;
    });

    await runBackup();

    expect(mockFs.unlinkSync).toHaveBeenCalled();
    const deleted = mockFs.unlinkSync.mock.calls.map(([p]) => String(p));
    expect(deleted.some(p => p.includes('2024-01-01'))).toBe(true);
  });
});
