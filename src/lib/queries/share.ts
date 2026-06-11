import { getDb } from '@/lib/db';
import { randomBytes } from 'crypto';
import { SHARE_TOKEN_TTL_HOURS } from '@/lib/config';

export interface ShareToken {
  id: number;
  token: string;
  photo_ids: string;
  label: string | null;
  created_at: number;
  expires_at: number;
  used_at: number | null;
}

export function createShareToken(photoIds: number[], label?: string): ShareToken {
  const db = getDb();
  const token = randomBytes(16).toString('hex'); // 32 hex chars
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SHARE_TOKEN_TTL_HOURS * 3600;

  db.prepare(`
    INSERT INTO share_tokens (token, photo_ids, label, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(token, JSON.stringify(photoIds), label ?? null, now, expiresAt);

  return db.prepare(`SELECT * FROM share_tokens WHERE token = ?`).get(token) as ShareToken;
}

export function getShareToken(token: string): ShareToken | undefined {
  const db = getDb();
  return db.prepare(`SELECT * FROM share_tokens WHERE token = ?`).get(token) as ShareToken | undefined;
}

export function markShareTokenUsed(token: string): void {
  const db = getDb();
  db.prepare(`UPDATE share_tokens SET used_at = unixepoch() WHERE token = ?`).run(token);
}

export function revokeShareToken(token: string): boolean {
  const db = getDb();
  const result = db.prepare(`DELETE FROM share_tokens WHERE token = ?`).run(token);
  return result.changes > 0;
}

export function listActiveShareTokens(): (ShareToken & { photo_count: number })[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM share_tokens
    WHERE expires_at >= unixepoch() AND used_at IS NULL
    ORDER BY created_at DESC
  `).all() as ShareToken[];

  return rows.map(r => ({
    ...r,
    photo_count: (JSON.parse(r.photo_ids) as number[]).length,
  }));
}

export function cleanExpiredShareTokens(): number {
  const db = getDb();
  const result = db.prepare(`DELETE FROM share_tokens WHERE expires_at < unixepoch()`).run();
  return result.changes;
}
