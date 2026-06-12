import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock fs ───────────────────────────────────────────────────────────────────
vi.mock('fs', () => ({
  default: {
    promises: {
      access: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
    },
    watch: vi.fn(),
  },
}));

// ── Mock scanState ─────────────────────────────────────────────────────────────
const mockGetScanState = vi.fn(() => ({ running: false }));
const mockUpdateScanState = vi.fn();
vi.mock('@/lib/scanState', () => ({
  getScanState: () => mockGetScanState(),
  updateScanState: (...args: unknown[]) => mockUpdateScanState(...args),
}));

// ── Mock watcherState ─────────────────────────────────────────────────────────
const mockGetWatcherState = vi.fn(() => ({ enabled: true, watching: false }));
const mockUpdateWatcherState = vi.fn();
vi.mock('@/lib/watcherState', () => ({
  getWatcherState: () => mockGetWatcherState(),
  updateWatcherState: (...args: unknown[]) => mockUpdateWatcherState(...args),
}));

// ── Mock classifyState ────────────────────────────────────────────────────────
vi.mock('@/lib/classifyState', () => ({
  getClassifyState: vi.fn(() => ({ running: false })),
  updateClassifyState: vi.fn(),
}));

// ── Mock scanner ──────────────────────────────────────────────────────────────
vi.mock('@/lib/scanner', () => ({
  scanLibrary: vi.fn().mockResolvedValue({ added: 0, total: 0 }),
}));

// ── Mock db ───────────────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => ({
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue([]),
      get: vi.fn().mockReturnValue(null),
    }),
  })),
}));

// ── Mock config ───────────────────────────────────────────────────────────────
vi.mock('@/lib/config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config');
  return { ...actual, PHOTOS_PATH: '/photos', WATCHER_DEBOUNCE_MS: 50, WATCHER_POLL_MS: 60_000 };
});

import fs from 'fs';
import { stopWatcher } from '@/lib/folderWatcher';
import { scanLibrary } from '@/lib/scanner';

const mockFsPromises = vi.mocked(fs.promises);
const mockFsWatch = vi.mocked(fs.watch);
const mockScanLibrary = vi.mocked(scanLibrary);

function makeDirStat() {
  return { isDirectory: () => true, isFile: () => false } as ReturnType<typeof fs.statSync>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetScanState.mockReturnValue({ running: false });
  mockGetWatcherState.mockReturnValue({ enabled: true, watching: false });
  mockFsPromises.access.mockResolvedValue(undefined);
  mockFsPromises.readdir.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof fs.promises.readdir>>);
  mockFsWatch.mockReturnValue({ on: vi.fn(), close: vi.fn() } as unknown as fs.FSWatcher);
});

afterEach(() => {
  stopWatcher();
});

describe('folderWatcher — scheduleAutoScan', () => {
  it('no lanza auto-scan si el scan ya está en curso', async () => {
    mockGetScanState.mockReturnValue({ running: true });

    // Import fresh module to reset module-level state
    const { startWatcher: start } = await import('@/lib/folderWatcher');
    await start();

    // Wait for debounce timer to fire (50ms)
    await new Promise(r => setTimeout(r, 100));

    expect(mockScanLibrary).not.toHaveBeenCalled();
  });

  it('el debounce no lanza scan si watcher está desactivado', async () => {
    mockGetWatcherState.mockReturnValue({ enabled: false, watching: false });

    const { startWatcher: start } = await import('@/lib/folderWatcher');
    await start();

    await new Promise(r => setTimeout(r, 100));

    expect(mockScanLibrary).not.toHaveBeenCalled();
  });
});
