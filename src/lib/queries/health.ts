import { getDb } from '@/lib/db';
import { getIntegrityReportMeta } from './integrity';

export type MetricStatus = 'green' | 'amber' | 'red' | 'na';

function status(pct: number): MetricStatus {
  if (pct >= 90) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

function countStatus(count: number): MetricStatus {
  if (count === 0) return 'green';
  if (count <= 5) return 'amber';
  return 'red';
}

export interface HealthMetrics {
  classification: { value: number; total: number; pct: number; status: MetricStatus };
  gps: { value: number; total: number; pct: number; status: MetricStatus };
  duplicates: { groups: number; status: MetricStatus };
  raw_pairs: { pairs: number; status: MetricStatus };
  tags_review: { pending: number; status: MetricStatus };
  integrity: { orphans: number; status: MetricStatus };
  // indexing is disk-based, computed separately
}

export interface HealthSnapshot {
  score: number;
  computed_at: string;
  metrics: HealthMetrics;
}

// Weights must sum to 100
const WEIGHTS = {
  classification: 30,
  integrity: 20,
  gps: 15,
  duplicates: 15,
  tags_review: 10,
  raw_pairs: 5,
  indexing: 5,
};

export function computeHealthMetrics(catalogId = 1): HealthMetrics {
  const db = getDb();

  const total = (db.prepare(
    `SELECT COUNT(*) as n FROM photos WHERE catalog_id = ?`
  ).get(catalogId) as { n: number }).n;

  // Classification: fotos con al menos un tag AI
  const classified = (db.prepare(`
    SELECT COUNT(DISTINCT p.id) as n
    FROM photos p
    JOIN photo_tags pt ON pt.photo_id = p.id
    WHERE p.catalog_id = ? AND pt.source = 'ai'
  `).get(catalogId) as { n: number }).n;

  // GPS
  const withGps = (db.prepare(
    `SELECT COUNT(*) as n FROM photos WHERE catalog_id = ? AND gps_lat IS NOT NULL`
  ).get(catalogId) as { n: number }).n;

  // Tags pendientes de revisión: fotos con solo tags AI (ninguna manual)
  const pendingReview = (db.prepare(`
    SELECT COUNT(DISTINCT p.id) as n
    FROM photos p
    WHERE p.catalog_id = ?
      AND EXISTS (
        SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id AND pt.source = 'ai'
      )
      AND NOT EXISTS (
        SELECT 1 FROM photo_tags pt2 WHERE pt2.photo_id = p.id AND pt2.source = 'manual'
      )
  `).get(catalogId) as { n: number }).n;

  // Duplicates and raw pairs — not yet implemented, return 0
  const duplicateGroups = 0;
  const rawPairs = 0;

  // Integrity from last report
  const integrityMeta = getIntegrityReportMeta();

  const classificationPct = total > 0 ? Math.round((classified / total) * 100) : 100;
  const gpsPct = total > 0 ? Math.round((withGps / total) * 100) : 100;

  return {
    classification: { value: classified, total, pct: classificationPct, status: status(classificationPct) },
    gps: { value: withGps, total, pct: gpsPct, status: status(gpsPct) },
    duplicates: { groups: duplicateGroups, status: countStatus(duplicateGroups) },
    raw_pairs: { pairs: rawPairs, status: countStatus(rawPairs) },
    tags_review: { pending: pendingReview, status: countStatus(pendingReview) },
    integrity: { orphans: integrityMeta.orphans, status: countStatus(integrityMeta.orphans) },
  };
}

export function computeScore(metrics: HealthMetrics, indexingPct = 100): number {
  const scores = {
    classification: metrics.classification.pct,
    integrity: metrics.integrity.orphans === 0 ? 100 : Math.max(0, 100 - metrics.integrity.orphans * 10),
    gps: metrics.gps.pct,
    duplicates: metrics.duplicates.groups === 0 ? 100 : Math.max(0, 100 - metrics.duplicates.groups * 5),
    tags_review: metrics.tags_review.pending === 0 ? 100 : Math.max(0, 100 - Math.round((metrics.tags_review.pending / Math.max(metrics.classification.total, 1)) * 100)),
    raw_pairs: metrics.raw_pairs.pairs === 0 ? 100 : Math.max(0, 100 - metrics.raw_pairs.pairs * 2),
    indexing: indexingPct,
  };

  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  const weighted = Object.entries(WEIGHTS).reduce(
    (sum, [key, weight]) => sum + (scores[key as keyof typeof scores] ?? 100) * weight,
    0,
  );
  return Math.round(weighted / total);
}

export function saveHealthSnapshot(score: number, metrics: HealthMetrics): void {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  db.prepare(`
    INSERT INTO health_snapshots (date, score, metrics_json)
    VALUES (?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET score = excluded.score, metrics_json = excluded.metrics_json
  `).run(today, score, JSON.stringify(metrics));
}

export function getHealthHistory(): { date: string; score: number }[] {
  return (getDb().prepare(`
    SELECT date, score FROM health_snapshots
    ORDER BY date DESC LIMIT 30
  `).all() as { date: string; score: number }[]).reverse();
}
