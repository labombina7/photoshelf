import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock session ──────────────────────────────────────────────────────────────
const mockSession = { isLoggedIn: true, save: vi.fn() };
vi.mock('@/lib/session', () => ({
  getSession: vi.fn(() => Promise.resolve(mockSession)),
  checkPassword: vi.fn(),
}));

// ── Mock catalog queries ──────────────────────────────────────────────────────
const mockList = vi.fn();
const mockCreate = vi.fn();
const mockDelete = vi.fn();
vi.mock('@/lib/queries/catalogs', () => ({
  listCatalogs: (...args: unknown[]) => mockList(...args),
  createCatalog: (...args: unknown[]) => mockCreate(...args),
  deleteCatalog: (...args: unknown[]) => mockDelete(...args),
}));

import { GET, POST } from '../route';

beforeEach(() => {
  mockSession.isLoggedIn = true;
  mockList.mockReset();
  mockCreate.mockReset();
  mockDelete.mockReset();
});

// ── GET /api/catalogs ────────────────────────────────────────────────────────

describe('GET /api/catalogs', () => {
  it('returns the catalog list when authenticated', async () => {
    mockList.mockReturnValue([{ id: 1, name: 'Principal', path: '/photos', created_at: 1, photo_count: 0 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.catalogs).toHaveLength(1);
    expect(body.catalogs[0].name).toBe('Principal');
  });

  it('returns 401 when not authenticated', async () => {
    mockSession.isLoggedIn = false;
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });
});

// ── POST /api/catalogs ───────────────────────────────────────────────────────

function makePost(body: unknown) {
  return new NextRequest('http://localhost/api/catalogs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/catalogs', () => {
  it('creates a catalog with valid input and returns 201', async () => {
    const created = { id: 2, name: 'Viajes', path: '/photos/viajes', created_at: 1, photo_count: 0 };
    mockCreate.mockReturnValue(created);
    const res = await POST(makePost({ name: 'Viajes', path: '/photos/viajes' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.catalog.name).toBe('Viajes');
  });

  it('returns 400 when name is missing', async () => {
    const res = await POST(makePost({ path: '/photos/test' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/nombre/i);
  });

  it('returns 400 when path is missing', async () => {
    const res = await POST(makePost({ name: 'Test' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ruta/i);
  });

  it('returns 400 when name exceeds 100 characters', async () => {
    const res = await POST(makePost({ name: 'a'.repeat(101), path: '/photos/test' }));
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    mockSession.isLoggedIn = false;
    const res = await POST(makePost({ name: 'Test', path: '/photos/test' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when createCatalog throws (e.g. duplicate path)', async () => {
    mockCreate.mockImplementation(() => { throw new Error('UNIQUE constraint failed'); });
    const res = await POST(makePost({ name: 'Dup', path: '/photos/dup' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/UNIQUE/);
  });
});
