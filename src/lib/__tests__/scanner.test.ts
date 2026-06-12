import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises before importing scanner
vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn(),
    stat: vi.fn(),
  },
}));

// Mock exifr (dynamic import in scanner.ts)
vi.mock('exifr', () => ({
  parse: vi.fn(),
}));

// Mock @/lib/db
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import fs from 'fs/promises';
import * as exifr from 'exifr';
import { getDb } from '@/lib/db';
import { scanLibrary } from '@/lib/scanner';

// Typed mocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReaddir = vi.mocked(fs.readdir) as any;
const mockStat = vi.mocked(fs.stat);
const mockExifrParse = vi.mocked(exifr.parse);
const mockGetDb = vi.mocked(getDb);

function makeStatDir() {
  return { isDirectory: () => true, isFile: () => false, size: 0 } as unknown as Awaited<ReturnType<typeof fs.stat>>;
}

function makeStatFile(size = 12345) {
  return { isDirectory: () => false, isFile: () => true, size } as unknown as Awaited<ReturnType<typeof fs.stat>>;
}

function makeMockDb(runFn = vi.fn()) {
  const prepareMock = vi.fn().mockReturnValue({ run: runFn });
  const transactionMock = vi.fn().mockImplementation((fn) => fn);
  const getMock = vi.fn().mockReturnValue({ c: 0 });

  return {
    prepare: prepareMock,
    transaction: transactionMock,
    get: getMock,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('scanLibrary', () => {
  it('indexes a JPEG with EXIF data (date and GPS)', async () => {
    const insertedPhotos: unknown[] = [];
    const runFn = vi.fn((photo: unknown) => { insertedPhotos.push(photo); });
    const db = makeMockDb(runFn);

    // Shared count mock so both SELECT COUNT calls use the same sequence
    const countGetMock = vi.fn()
      .mockReturnValueOnce({ c: 0 })  // countBefore
      .mockReturnValueOnce({ c: 1 }); // total after scan
    db.prepare.mockImplementation((sql: string) => {
      if (sql.trim().startsWith('SELECT COUNT')) {
        return { get: countGetMock };
      }
      return { run: runFn };
    });

    // transaction returns a function that immediately calls the batch
    db.transaction.mockImplementation((fn: (items: unknown[]) => void) => {
      return (items: unknown[]) => fn(items);
    });

    mockGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    // File system structure: /photos/2024/evento/foto.jpg
    mockReaddir.mockImplementation(async (dirPath: unknown) => {
      const p = dirPath as string;
      if (p === '/photos') return ['2024'] as unknown as string[];
      if (p.endsWith('/2024')) return ['evento'] as unknown as string[];
      if (p.endsWith('/evento')) return ['foto.jpg'] as unknown as string[];
      return [] as unknown as string[];
    });

    mockStat.mockImplementation(async (filePath: unknown) => {
      const p = filePath as string;
      if (p.endsWith('/2024') || p.endsWith('/evento')) return makeStatDir();
      if (p.endsWith('foto.jpg')) return makeStatFile(54321);
      return makeStatDir();
    });

    // EXIF with date and GPS
    mockExifrParse.mockResolvedValue({
      DateTimeOriginal: new Date('2024-06-15T12:00:00Z'),
      Make: 'Canon',
      Model: 'EOS 90D',
      ExposureTime: 1 / 200,
      FNumber: 5.6,
      ISO: 400,
      ImageWidth: 3000,
      ImageHeight: 2000,
      latitude: 40.416775,
      longitude: -3.70379,
    });

    const result = await scanLibrary('/photos');

    expect(result.added).toBe(1);
    expect(result.total).toBe(1);
    expect(insertedPhotos).toHaveLength(1);

    const photo = insertedPhotos[0] as Record<string, unknown>;
    expect(photo.path).toBe('2024/evento/foto.jpg');
    expect(photo.filename).toBe('foto.jpg');
    expect(photo.year).toBe(2024);
    expect(photo.event).toBe('evento');
    expect(photo.camera).toBe('Canon EOS 90D');
    expect(photo.gps_lat).toBe(40.416775);
    expect(photo.gps_lon).toBe(-3.70379);
    expect(photo.taken_at).toBeTruthy();
    expect(photo.width).toBe(3000);
    expect(photo.height).toBe(2000);
  });

  it('ignores non-image files (.txt, .mp4)', async () => {
    const insertedPhotos: unknown[] = [];
    const runFn = vi.fn((photo: unknown) => { insertedPhotos.push(photo); });
    const db = makeMockDb(runFn);

    db.prepare.mockImplementation((sql: string) => {
      if (sql.trim().startsWith('SELECT COUNT')) {
        return { get: vi.fn().mockReturnValue({ c: 0 }) };
      }
      return { run: runFn };
    });

    db.transaction.mockImplementation((fn: (items: unknown[]) => void) => {
      return (items: unknown[]) => fn(items);
    });

    mockGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    mockReaddir.mockImplementation(async (dirPath: unknown) => {
      const p = dirPath as string;
      if (p === '/photos') return ['2024'] as unknown as string[];
      if (p.endsWith('/2024')) return ['evento'] as unknown as string[];
      if (p.endsWith('/evento')) return ['document.txt', 'video.mp4', 'notes.doc'] as unknown as string[];
      return [] as unknown as string[];
    });

    mockStat.mockImplementation(async (filePath: unknown) => {
      const p = filePath as string;
      if (p.endsWith('/2024') || p.endsWith('/evento')) return makeStatDir();
      return makeStatFile();
    });

    await scanLibrary('/photos');

    // No photos should be inserted since all files are non-images
    expect(insertedPhotos).toHaveLength(0);
  });

  it('handles photos without EXIF (taken_at and GPS are null)', async () => {
    const insertedPhotos: unknown[] = [];
    const runFn = vi.fn((photo: unknown) => { insertedPhotos.push(photo); });
    const db = makeMockDb(runFn);

    db.prepare.mockImplementation((sql: string) => {
      if (sql.trim().startsWith('SELECT COUNT')) {
        return { get: vi.fn().mockReturnValueOnce({ c: 0 }).mockReturnValueOnce({ c: 1 }) };
      }
      return { run: runFn };
    });

    db.transaction.mockImplementation((fn: (items: unknown[]) => void) => {
      return (items: unknown[]) => fn(items);
    });

    mockGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    mockReaddir.mockImplementation(async (dirPath: unknown) => {
      const p = dirPath as string;
      if (p === '/photos') return ['2023'] as unknown as string[];
      if (p.endsWith('/2023')) return ['familia'] as unknown as string[];
      if (p.endsWith('/familia')) return ['sin_exif.jpg'] as unknown as string[];
      return [] as unknown as string[];
    });

    mockStat.mockImplementation(async (filePath: unknown) => {
      const p = filePath as string;
      if (p.endsWith('/2023') || p.endsWith('/familia')) return makeStatDir();
      if (p.endsWith('sin_exif.jpg')) return makeStatFile(8000);
      return makeStatDir();
    });

    // Return null from exifr — no EXIF data
    mockExifrParse.mockResolvedValue(null);

    await scanLibrary('/photos');

    expect(insertedPhotos).toHaveLength(1);
    const photo = insertedPhotos[0] as Record<string, unknown>;
    expect(photo.taken_at).toBeNull();
    expect(photo.gps_lat).toBeNull();
    expect(photo.gps_lon).toBeNull();
    expect(photo.camera).toBeNull();
  });

  it('uses ON CONFLICT DO UPDATE — calls upsert run for each photo including duplicates', async () => {
    // The scanner always calls upsert.run for every file it finds.
    // The ON CONFLICT DO UPDATE in the SQL handles deduplication at DB level.
    // Here we verify the scanner calls run() for both the new and the "duplicate" file.
    const runCalls: unknown[] = [];
    const runFn = vi.fn((photo: unknown) => { runCalls.push(photo); });
    const db = makeMockDb(runFn);

    db.prepare.mockImplementation((sql: string) => {
      if (sql.trim().startsWith('SELECT COUNT')) {
        return { get: vi.fn().mockReturnValue({ c: 1 }) };
      }
      return { run: runFn };
    });

    db.transaction.mockImplementation((fn: (items: unknown[]) => void) => {
      return (items: unknown[]) => fn(items);
    });

    mockGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    // Two JPEG files in the same event folder
    mockReaddir.mockImplementation(async (dirPath: unknown) => {
      const p = dirPath as string;
      if (p === '/photos') return ['2024'] as unknown as string[];
      if (p.endsWith('/2024')) return ['evento'] as unknown as string[];
      if (p.endsWith('/evento')) return ['foto1.jpg', 'foto2.jpg'] as unknown as string[];
      return [] as unknown as string[];
    });

    mockStat.mockImplementation(async (filePath: unknown) => {
      const p = filePath as string;
      if (p.endsWith('/2024') || p.endsWith('/evento')) return makeStatDir();
      return makeStatFile();
    });

    mockExifrParse.mockResolvedValue(null);

    await scanLibrary('/photos');

    // Both files should be inserted via upsert.run
    expect(runCalls).toHaveLength(2);
    const paths = runCalls.map((p) => (p as Record<string, unknown>).filename);
    expect(paths).toContain('foto1.jpg');
    expect(paths).toContain('foto2.jpg');
  });
});
