import { getDb } from '@/lib/db';
import { PHOTOS_PATH } from '@/lib/config';
import fsSync from 'fs';

export interface IntegrityReport {
  id: number;
  type: 'orphan' | 'unindexed' | 'corrupt' | 'orphan_thumbnail';
  path: string;
  photo_id: number | null;
  error_msg: string | null;
  detected_at: string;
}

export function clearIntegrityReports(): void {
  getDb().prepare(`DELETE FROM integrity_reports`).run();
}

export function insertIntegrityReport(
  type: 'orphan' | 'unindexed' | 'corrupt' | 'orphan_thumbnail',
  filePath: string,
  photoId?: number,
  errorMsg?: string,
): void {
  getDb().prepare(`
    INSERT INTO integrity_reports (type, path, photo_id, error_msg)
    VALUES (?, ?, ?, ?)
  `).run(type, filePath, photoId ?? null, errorMsg ?? null);
}

export function getIntegrityReport(): IntegrityReport[] {
  return getDb().prepare(
    `SELECT * FROM integrity_reports ORDER BY type, detected_at ASC`
  ).all() as IntegrityReport[];
}

export function getIntegrityReportByType(type: 'orphan' | 'unindexed' | 'corrupt' | 'orphan_thumbnail'): IntegrityReport[] {
  return getDb().prepare(
    `SELECT * FROM integrity_reports WHERE type = ? ORDER BY detected_at ASC`
  ).all(type) as IntegrityReport[];
}

export function getIntegrityReportMeta(): { total: number; orphans: number; unindexed: number; corrupt: number; orphanThumbnails: number; lastRun: string | null } {
  const db = getDb();
  const counts = db.prepare(`
    SELECT type, COUNT(*) as n FROM integrity_reports GROUP BY type
  `).all() as { type: string; n: number }[];

  const byType = Object.fromEntries(counts.map(r => [r.type, r.n]));
  const lastRun = (db.prepare(
    `SELECT MAX(detected_at) as d FROM integrity_reports`
  ).get() as { d: string | null })?.d ?? null;

  return {
    total: counts.reduce((s, r) => s + r.n, 0),
    orphans: byType['orphan'] ?? 0,
    unindexed: byType['unindexed'] ?? 0,
    corrupt: byType['corrupt'] ?? 0,
    orphanThumbnails: byType['orphan_thumbnail'] ?? 0,
    lastRun,
  };
}

export function removeOrphansByIds(ids: number[]): number {
  if (ids.length === 0) return 0;
  const db = getDb();
  const ph = ids.map(() => '?').join(',');

  // Also remove from photos table
  const rows = db.prepare(
    `SELECT photo_id FROM integrity_reports WHERE id IN (${ph}) AND type = 'orphan' AND photo_id IS NOT NULL`
  ).all(...ids) as { photo_id: number }[];

  const photoIds = rows.map(r => r.photo_id);
  if (photoIds.length > 0) {
    const ph2 = photoIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM photos WHERE id IN (${ph2})`).run(...photoIds);
  }

  const result = db.prepare(
    `DELETE FROM integrity_reports WHERE id IN (${ph})`
  ).run(...ids);

  return result.changes;
}

export function removeOrphanThumbnailsByIds(ids: number[]): { removed: number; errors: string[] } {
  if (ids.length === 0) return { removed: 0, errors: [] };
  const db = getDb();
  const ph = ids.map(() => '?').join(',');

  const rows = db.prepare(
    `SELECT id, path FROM integrity_reports WHERE id IN (${ph}) AND type = 'orphan_thumbnail'`
  ).all(...ids) as { id: number; path: string }[];

  let removed = 0;
  const errors: string[] = [];
  const resolvedIds: number[] = [];

  for (const row of rows) {
    try {
      fsSync.unlinkSync(row.path);
      removed++;
      resolvedIds.push(row.id);
    } catch (err) {
      errors.push(`${row.path}: ${err instanceof Error ? err.message : 'error'}`);
    }
  }

  if (resolvedIds.length > 0) {
    const ph2 = resolvedIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM integrity_reports WHERE id IN (${ph2})`).run(...resolvedIds);
  }

  return { removed, errors };
}

export function getAllPhotoPaths(catalogId?: number): { id: number; path: string }[] {
  const db = getDb();
  if (catalogId != null) {
    return db.prepare(
      `SELECT id, path FROM photos WHERE catalog_id = ?`
    ).all(catalogId) as { id: number; path: string }[];
  }
  return db.prepare(`SELECT id, path FROM photos`).all() as { id: number; path: string }[];
}

export function getAllPhotosWithCatalogPath(): { path: string; catalog_path: string }[] {
  return getDb().prepare(`
    SELECT p.path, COALESCE(c.path, ?) as catalog_path
    FROM photos p
    LEFT JOIN catalogs c ON c.id = p.catalog_id
  `).all(PHOTOS_PATH) as { path: string; catalog_path: string }[];
}

export function getIndexedPathsSet(catalogId?: number): Set<string> {
  const rows = getAllPhotoPaths(catalogId);
  return new Set(rows.map(r => r.path));
}
