import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { SHARE_RETRY_WINDOW_MINUTES } from '@/lib/config';

// BD real en memoria — los tests de la ventana de reintentos validan SQL de verdad
let db: Database.Database;
vi.mock('@/lib/db', () => ({
  getDb: () => db,
}));

import {
  createShareToken,
  getShareToken,
  markShareTokenUsed,
  isShareTokenExhausted,
  listActiveShareTokens,
} from '@/lib/queries/share';

const WINDOW_S = SHARE_RETRY_WINDOW_MINUTES * 60;

function now(): number {
  return Math.floor(Date.now() / 1000);
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

describe('markShareTokenUsed — semántica de ventana', () => {
  it('fija used_at en el primer uso', () => {
    const t = createShareToken([1, 2, 3], 'test');
    expect(t.used_at).toBeNull();

    markShareTokenUsed(t.token);
    const after = getShareToken(t.token)!;
    expect(after.used_at).not.toBeNull();
  });

  it('NO desplaza used_at en usos posteriores (la ventana no se extiende)', () => {
    const t = createShareToken([1], 'test');
    markShareTokenUsed(t.token);
    const first = getShareToken(t.token)!.used_at;

    // Simula un primer uso antiguo y reintenta
    db.prepare(`UPDATE share_tokens SET used_at = ? WHERE token = ?`).run(now() - 1800, t.token);
    markShareTokenUsed(t.token);

    expect(getShareToken(t.token)!.used_at).toBe(now() - 1800);
    expect(first).not.toBeNull();
  });
});

describe('isShareTokenExhausted', () => {
  it('un token sin usar no está agotado', () => {
    const t = createShareToken([1]);
    expect(isShareTokenExhausted(t)).toBe(false);
  });

  it('dentro de la ventana de reintentos no está agotado', () => {
    const t = createShareToken([1]);
    const usedAt = now() - (WINDOW_S - 60); // usado hace casi una ventana
    expect(isShareTokenExhausted({ ...t, used_at: usedAt })).toBe(false);
  });

  it('pasada la ventana está agotado', () => {
    const t = createShareToken([1]);
    const usedAt = now() - (WINDOW_S + 60);
    expect(isShareTokenExhausted({ ...t, used_at: usedAt })).toBe(true);
  });
});

describe('listActiveShareTokens', () => {
  it('incluye tokens usados que siguen dentro de la ventana', () => {
    const t = createShareToken([1, 2], 'reciente');
    db.prepare(`UPDATE share_tokens SET used_at = ? WHERE token = ?`).run(now() - 60, t.token);

    const active = listActiveShareTokens();
    expect(active.map(a => a.token)).toContain(t.token);
    expect(active[0].photo_count).toBe(2);
  });

  it('excluye tokens con la ventana agotada', () => {
    const t = createShareToken([1], 'viejo');
    db.prepare(`UPDATE share_tokens SET used_at = ? WHERE token = ?`).run(now() - (WINDOW_S + 120), t.token);

    expect(listActiveShareTokens().map(a => a.token)).not.toContain(t.token);
  });
});
