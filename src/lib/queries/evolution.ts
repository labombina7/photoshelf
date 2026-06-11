/**
 * Queries for the photographic evolution feature (US-095).
 * All queries exclude mobile cameras and years < 1990 with < 10 photos.
 */

import { getDb } from '@/lib/db';
import { mobileCameraExclusionSQL, mobileCameraExclusionParams } from '@/lib/config';

const MOB_SQL = mobileCameraExclusionSQL('');
const MOB_PARAMS = mobileCameraExclusionParams();

const MIN_PHOTOS_PER_YEAR = 10;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FocalByYear {
  year: number;
  focal_length: number;
  count: number;
}

export interface TagByYear {
  year: number;
  tag: string;
  count: number;
  percent: number;
}

export interface CameraByYear {
  year: number;
  camera: string;
  count: number;
  percent: number;
}

export interface HourByYear {
  year: number;
  avg_hour: number;
}

export interface EvolutionData {
  years: number[];
  focals: FocalByYear[];
  tags: TagByYear[];
  cameras: CameraByYear[];
  hours: HourByYear[];
}

export interface SavedAnalysis {
  generated_at: string;
  data_hash: string;
  analysis: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function activeYears(): number[] {
  const db = getDb();
  return (db.prepare(`
    SELECT CAST(strftime('%Y', taken_at) AS INTEGER) AS year, COUNT(*) AS n
    FROM photos
    WHERE taken_at IS NOT NULL
      AND CAST(strftime('%Y', taken_at) AS INTEGER) >= 1990
      AND ${MOB_SQL}
    GROUP BY year
    HAVING n >= ${MIN_PHOTOS_PER_YEAR}
    ORDER BY year ASC
  `).all(...MOB_PARAMS) as { year: number; n: number }[]).map(r => r.year);
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function getFocalEvolution(): FocalByYear[] {
  const years = activeYears();
  if (years.length === 0) return [];
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      CAST(strftime('%Y', taken_at) AS INTEGER) AS year,
      ROUND(focal_length) AS focal_length,
      COUNT(*) AS count
    FROM photos
    WHERE taken_at IS NOT NULL
      AND focal_length IS NOT NULL
      AND CAST(strftime('%Y', taken_at) AS INTEGER) IN (${years.map(() => '?').join(',')})
      AND ${MOB_SQL}
    GROUP BY year, focal_length
    ORDER BY year ASC, count DESC
  `).all(...years, ...MOB_PARAMS) as { year: number; focal_length: number; count: number }[];

  // Keep top 5 focals per year
  const byYear = new Map<number, typeof rows>();
  for (const row of rows) {
    if (!byYear.has(row.year)) byYear.set(row.year, []);
    byYear.get(row.year)!.push(row);
  }
  const result: FocalByYear[] = [];
  for (const [, yearRows] of byYear) {
    result.push(...yearRows.slice(0, 5));
  }
  return result;
}

export function getTagEvolution(): TagByYear[] {
  const years = activeYears();
  if (years.length === 0) return [];
  const db = getDb();

  // Total photos per year (for percent calculation)
  const totals = new Map<number, number>();
  (db.prepare(`
    SELECT CAST(strftime('%Y', taken_at) AS INTEGER) AS year, COUNT(*) AS n
    FROM photos
    WHERE taken_at IS NOT NULL
      AND CAST(strftime('%Y', taken_at) AS INTEGER) IN (${years.map(() => '?').join(',')})
      AND ${MOB_SQL}
    GROUP BY year
  `).all(...years, ...MOB_PARAMS) as { year: number; n: number }[])
    .forEach(r => totals.set(r.year, r.n));

  const rows = db.prepare(`
    SELECT
      CAST(strftime('%Y', p.taken_at) AS INTEGER) AS year,
      t.name AS tag,
      COUNT(*) AS count
    FROM photo_tags pt
    JOIN photos p ON p.id = pt.photo_id
    JOIN tags t ON t.id = pt.tag_id
    WHERE p.taken_at IS NOT NULL
      AND pt.source = 'ai'
      AND CAST(strftime('%Y', p.taken_at) AS INTEGER) IN (${years.map(() => '?').join(',')})
      AND ${mobileCameraExclusionSQL('p')}
    GROUP BY year, t.name
    ORDER BY year ASC, count DESC
  `).all(...years, ...MOB_PARAMS) as { year: number; tag: string; count: number }[];

  // Keep top 5 tags per year
  const byYear = new Map<number, typeof rows>();
  for (const row of rows) {
    if (!byYear.has(row.year)) byYear.set(row.year, []);
    byYear.get(row.year)!.push(row);
  }
  const result: TagByYear[] = [];
  for (const [year, yearRows] of byYear) {
    const total = totals.get(year) ?? 1;
    for (const row of yearRows.slice(0, 5)) {
      result.push({ ...row, percent: Math.round((row.count / total) * 100) });
    }
  }
  return result;
}

export function getCameraEvolution(): CameraByYear[] {
  const years = activeYears();
  if (years.length === 0) return [];
  const db = getDb();

  const totals = new Map<number, number>();
  (db.prepare(`
    SELECT CAST(strftime('%Y', taken_at) AS INTEGER) AS year, COUNT(*) AS n
    FROM photos
    WHERE taken_at IS NOT NULL
      AND CAST(strftime('%Y', taken_at) AS INTEGER) IN (${years.map(() => '?').join(',')})
      AND ${MOB_SQL}
    GROUP BY year
  `).all(...years, ...MOB_PARAMS) as { year: number; n: number }[])
    .forEach(r => totals.set(r.year, r.n));

  const rows = db.prepare(`
    SELECT
      CAST(strftime('%Y', taken_at) AS INTEGER) AS year,
      camera,
      COUNT(*) AS count
    FROM photos
    WHERE taken_at IS NOT NULL
      AND camera IS NOT NULL
      AND CAST(strftime('%Y', taken_at) AS INTEGER) IN (${years.map(() => '?').join(',')})
      AND ${MOB_SQL}
    GROUP BY year, camera
    ORDER BY year ASC, count DESC
  `).all(...years, ...MOB_PARAMS) as { year: number; camera: string; count: number }[];

  const byYear = new Map<number, typeof rows>();
  for (const row of rows) {
    if (!byYear.has(row.year)) byYear.set(row.year, []);
    byYear.get(row.year)!.push(row);
  }
  const result: CameraByYear[] = [];
  for (const [year, yearRows] of byYear) {
    const total = totals.get(year) ?? 1;
    for (const row of yearRows.slice(0, 5)) {
      // Shorten camera names: "OLYMPUS CORPORATION E-M1MarkII" → "E-M1MarkII"
      const shortName = row.camera
        .replace(/^(Canon|Nikon|Sony|Fujifilm|Olympus|Panasonic|Leica|Ricoh|RICOH|Apple|Samsung)\s*/i, '')
        .replace(/^(CORPORATION|IMAGING CORP\.|IMAGING CORP|Corp\.?)\s*/i, '')
        .trim();
      result.push({ year, camera: shortName || row.camera, count: row.count, percent: Math.round((row.count / total) * 100) });
    }
  }
  return result;
}

export function getShootingHourEvolution(): HourByYear[] {
  const years = activeYears();
  if (years.length === 0) return [];
  const db = getDb();

  return db.prepare(`
    SELECT
      CAST(strftime('%Y', taken_at) AS INTEGER) AS year,
      AVG(
        CAST(strftime('%H', taken_at) AS REAL) +
        CAST(strftime('%M', taken_at) AS REAL) / 60.0
      ) AS avg_hour
    FROM photos
    WHERE taken_at IS NOT NULL
      AND CAST(strftime('%Y', taken_at) AS INTEGER) IN (${years.map(() => '?').join(',')})
      AND ${MOB_SQL}
    GROUP BY year
    ORDER BY year ASC
  `).all(...years, ...MOB_PARAMS) as HourByYear[];
}

export function getEvolutionData(): EvolutionData {
  return {
    years: activeYears(),
    focals: getFocalEvolution(),
    tags: getTagEvolution(),
    cameras: getCameraEvolution(),
    hours: getShootingHourEvolution(),
  };
}

// ── Saved analysis ────────────────────────────────────────────────────────────

export function getEvolutionAnalysis(): SavedAnalysis | null {
  const row = getDb().prepare(
    `SELECT generated_at, data_hash, analysis FROM evolution_analysis ORDER BY id DESC LIMIT 1`
  ).get() as SavedAnalysis | undefined;
  return row ?? null;
}

export function saveEvolutionAnalysis(dataHash: string, analysis: string): void {
  getDb().prepare(`
    INSERT INTO evolution_analysis (generated_at, data_hash, analysis)
    VALUES (datetime('now'), ?, ?)
  `).run(dataHash, analysis);
}
