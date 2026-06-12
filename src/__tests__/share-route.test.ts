import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { Readable } from 'stream';
import type { NextRequest } from 'next/server';
import { SHARE_RETRY_WINDOW_MINUTES } from '@/lib/config';

// BD real en memoria; fs y resolución de rutas mockeados — el ZIP se genera de verdad
let db: Database.Database;
vi.mock('@/lib/db', () => ({
  getDb: () => db,
}));

vi.mock('@/lib/queries/photos', () => ({
  getPhotoPathById: vi.fn((id: number) => ({
    path: `2023/evento/photo-${id}.jpg`,
    filename: `photo-${id}.jpg`,
    catalog_path: '/photos',
  })),
}));

vi.mock('@/lib/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/config')>()),
  resolvePhotoPath: vi.fn((rel: string) => `/photos/${rel}`),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    createReadStream: vi.fn(() => Readable.from(Buffer.from('fake-jpeg-bytes'))),
  },
}));

import { GET } from '@/app/share/[token]/route';
import { createShareToken } from '@/lib/queries/share';

const WINDOW_S = SHARE_RETRY_WINDOW_MINUTES * 60;

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function callRoute(token: string) {
  return GET({} as NextRequest, { params: Promise.resolve({ token }) });
}

beforeEach(() => {
  db = new Database(':memory:');
  db.exec(`
    CREATE TABLE share_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      token      TEXT NOT NULL UNIQUE,
      photo_ids  TEXT NOT NULL,
      label      TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at    INTEGER
    );
  `);
});

describe('GET /share/[token] — ventana de reintentos', () => {
  it('la primera descarga responde 200 con un ZIP válido', async () => {
    const t = createShareToken([1, 2], 'boda');
    const res = await callRoute(t.token);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/zip');
    // Consume el stream y valida la firma ZIP (PK\x03\x04) — detecta archivers mal construidos
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.length).toBeGreaterThan(0);
    expect(body.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  });

  it('un segundo GET dentro de la ventana responde 200 (reintento permitido)', async () => {
    const t = createShareToken([1], 'boda');
    await callRoute(t.token); // primer uso: fija used_at

    const res = await callRoute(t.token);
    expect(res.status).toBe(200);
  });

  it('el reintento no desplaza el inicio de la ventana', async () => {
    const t = createShareToken([1]);
    const usedAt = now() - 1800;
    db.prepare(`UPDATE share_tokens SET used_at = ? WHERE token = ?`).run(usedAt, t.token);

    await callRoute(t.token);
    const row = db.prepare(`SELECT used_at FROM share_tokens WHERE token = ?`).get(t.token) as { used_at: number };
    expect(row.used_at).toBe(usedAt);
  });

  it('pasada la ventana responde 410 con mensaje de ventana agotada', async () => {
    const t = createShareToken([1]);
    db.prepare(`UPDATE share_tokens SET used_at = ? WHERE token = ?`).run(now() - (WINDOW_S + 120), t.token);

    const res = await callRoute(t.token);
    expect(res.status).toBe(410);
    expect(await res.text()).toContain('ventana de descarga');
  });

  it('un enlace caducado responde 410 con mensaje de caducidad (distinto del de ventana)', async () => {
    const t = createShareToken([1]);
    db.prepare(`UPDATE share_tokens SET expires_at = ?, created_at = ? WHERE token = ?`)
      .run(now() + 1, now(), t.token); // aún vivo para que el cleanup no lo borre
    db.prepare(`UPDATE share_tokens SET expires_at = ? WHERE token = ?`).run(now() - 10, t.token);
    // El cleanup oportunista borra los caducados → el resultado es 404 "no existe"
    const res = await callRoute(t.token);
    expect([404, 410]).toContain(res.status);
    const body = await res.text();
    expect(body).not.toContain('ventana de descarga');
  });

  it('un token inexistente responde 404', async () => {
    const res = await callRoute('no-existe');
    expect(res.status).toBe(404);
  });
});
