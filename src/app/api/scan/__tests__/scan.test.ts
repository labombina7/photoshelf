import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock next/server after() ──────────────────────────────────────────────────
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: vi.fn((fn: () => unknown) => fn()) };
});

// ── Mock session ──────────────────────────────────────────────────────────────
const mockSession = { isLoggedIn: true, save: vi.fn() };
vi.mock('@/lib/session', () => ({
  getSession: vi.fn(() => Promise.resolve(mockSession)),
}));

// ── Mock scan state ───────────────────────────────────────────────────────────
const mockScanState = { running: false, done: 0, total: 0, currentEvent: '', error: null, completedAt: null };
const mockUpdateScanState = vi.fn((patch: Partial<typeof mockScanState>) => Object.assign(mockScanState, patch));
vi.mock('@/lib/scanState', () => ({
  getScanState: vi.fn(() => ({ ...mockScanState })),
  updateScanState: (patch: Partial<typeof mockScanState>) => mockUpdateScanState(patch),
}));

// ── Mock catalog context ──────────────────────────────────────────────────────
vi.mock('@/lib/catalog-context', () => ({
  getActiveCatalogId: vi.fn(() => Promise.resolve(1)),
}));

// ── Mock catalog query ────────────────────────────────────────────────────────
vi.mock('@/lib/queries/catalogs', () => ({
  getCatalogById: vi.fn(() => ({ id: 1, name: 'Principal', path: '/tmp', created_at: 1, photo_count: 0 })),
}));

// ── Mock scanner (so after() doesn't actually scan) ──────────────────────────
vi.mock('@/lib/scanner', () => ({
  scanLibrary: vi.fn(() => Promise.resolve({ added: 0, total: 0 })),
}));

// ── Mock fs.promises.access to simulate accessible path ──────────────────────
vi.mock('fs/promises', () => ({
  default: { access: vi.fn(() => Promise.resolve()) },
  access: vi.fn(() => Promise.resolve()),
}));

import { POST } from '../route';
import { GET } from '../status/route';

beforeEach(() => {
  mockSession.isLoggedIn = true;
  mockScanState.running = false;
  mockUpdateScanState.mockClear();
});

// ── POST /api/scan ────────────────────────────────────────────────────────────

describe('POST /api/scan', () => {
  it('returns 202 when scan starts successfully', async () => {
    const res = await POST();
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('returns 409 when a scan is already running', async () => {
    mockScanState.running = true;
    const res = await POST();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('returns 401 when not authenticated', async () => {
    mockSession.isLoggedIn = false;
    const res = await POST();
    expect(res.status).toBe(401);
  });
});

// ── GET /api/scan/status ──────────────────────────────────────────────────────

describe('GET /api/scan/status', () => {
  it('returns scan state when authenticated', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('running');
  });

  it('returns 401 when not authenticated', async () => {
    mockSession.isLoggedIn = false;
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
