import { getDb } from '@/lib/db';
import type { StyleSignals, PeriodStyleSummary, StyleProfile, BootstrapProgress } from '@/lib/types';

// ── US-074: Extracción de señales EXIF ───────────────────────────────────────

export function getPhotoStyleSignals(photoId: number): StyleSignals | undefined {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      p.id,
      p.focal_length,
      p.aperture,
      p.iso,
      p.shutter_speed_seconds,
      p.taken_at,
      p.camera,
      t_genre.name AS genre
    FROM photos p
    LEFT JOIN photo_tags pt_genre ON pt_genre.photo_id = p.id AND pt_genre.source = 'ai'
    LEFT JOIN tags t_genre ON t_genre.id = pt_genre.tag_id
      AND t_genre.name IN ('retrato','paisaje','arquitectura','street','naturaleza','macro','deporte','noche','abstracto','documental')
    WHERE p.id = ?
    LIMIT 1
  `).get(photoId) as {
    id: number; focal_length: number | null; aperture: number | null;
    iso: number | null; shutter_speed_seconds: number | null;
    taken_at: string | null; camera: string | null; genre: string | null;
  } | undefined;

  if (!row) return undefined;

  return {
    photoId: row.id,
    focalLength: row.focal_length,
    aperture: row.aperture,
    iso: row.iso,
    shutterSpeed: row.shutter_speed_seconds,
    capturedAt: row.taken_at,
    camera: row.camera,
    lens: null, // no lens column in current schema
    genre: row.genre,
  };
}

export function getStyleSignalsByPeriod({ from, to }: { from: string; to: string }): PeriodStyleSummary {
  const db = getDb();

  const agg = db.prepare(`
    SELECT
      COUNT(*) AS photo_count,
      AVG(focal_length) AS avg_focal,
      AVG(aperture) AS avg_aperture,
      AVG(iso) AS avg_iso,
      AVG(CAST(strftime('%H', taken_at) AS REAL) + CAST(strftime('%M', taken_at) AS REAL) / 60.0) AS avg_hour
    FROM photos
    WHERE taken_at >= ? AND taken_at < ?
  `).get(from, to) as {
    photo_count: number; avg_focal: number | null; avg_aperture: number | null;
    avg_iso: number | null; avg_hour: number | null;
  };

  const topCamera = (db.prepare(`
    SELECT camera, COUNT(*) AS n FROM photos
    WHERE taken_at >= ? AND taken_at < ? AND camera IS NOT NULL
    GROUP BY camera ORDER BY n DESC LIMIT 1
  `).get(from, to) as { camera: string } | undefined)?.camera ?? null;

  const topGenres = (db.prepare(`
    SELECT t.name, COUNT(*) AS n
    FROM photo_tags pt
    JOIN tags t ON t.id = pt.tag_id
    JOIN photos p ON p.id = pt.photo_id
    WHERE p.taken_at >= ? AND p.taken_at < ?
      AND t.name IN ('retrato','paisaje','arquitectura','street','naturaleza','macro','deporte','noche','abstracto','documental')
    GROUP BY t.name ORDER BY n DESC LIMIT 5
  `).all(from, to) as { name: string }[]).map(r => r.name);

  const topTags = (db.prepare(`
    SELECT t.name, COUNT(*) AS n
    FROM photo_tags pt
    JOIN tags t ON t.id = pt.tag_id
    JOIN photos p ON p.id = pt.photo_id
    WHERE p.taken_at >= ? AND p.taken_at < ? AND pt.source = 'ai'
    GROUP BY t.name ORDER BY n DESC LIMIT 10
  `).all(from, to) as { name: string }[]).map(r => r.name);

  return {
    period: from.substring(0, 7),
    photoCount: agg.photo_count,
    avgFocalLength: agg.avg_focal ? Math.round(agg.avg_focal) : null,
    avgAperture: agg.avg_aperture ? Math.round(agg.avg_aperture * 10) / 10 : null,
    avgIso: agg.avg_iso ? Math.round(agg.avg_iso) : null,
    avgHourOfDay: agg.avg_hour ? Math.round(agg.avg_hour * 10) / 10 : null,
    topCamera,
    topLens: null,
    topGenres,
    topTags,
  };
}

// ── US-074: Selección de muestra representativa ───────────────────────────────

export function selectRepresentativeSample({
  from,
  to,
  maxPhotos = 50,
}: {
  from: string;
  to: string;
  maxPhotos?: number;
}): number[] {
  const db = getDb();

  // Get all photos in period with their tag diversity score
  const photos = db.prepare(`
    SELECT
      p.id,
      p.taken_at,
      strftime('%H', p.taken_at) AS hour_bucket,
      COUNT(pt.tag_id) AS tag_count
    FROM photos p
    LEFT JOIN photo_tags pt ON pt.photo_id = p.id AND pt.source = 'ai'
    WHERE p.taken_at >= ? AND p.taken_at < ?
    GROUP BY p.id
    ORDER BY p.taken_at ASC
  `).all(from, to) as { id: number; taken_at: string | null; hour_bucket: string | null; tag_count: number }[];

  if (photos.length <= maxPhotos) return photos.map(p => p.id);

  // Distribute by hour-of-day bucket (morning/afternoon/evening/night) for diversity
  const buckets = new Map<string, typeof photos>();
  for (const p of photos) {
    const hour = parseInt(p.hour_bucket ?? '12', 10);
    const bucket = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(p);
  }

  const result: number[] = [];
  const bucketEntries = Array.from(buckets.entries());
  let remaining = maxPhotos;

  bucketEntries.forEach(([, bPhotos], i) => {
    const share = Math.round((bPhotos.length / photos.length) * maxPhotos);
    const quota = i === bucketEntries.length - 1 ? remaining : Math.min(share, remaining);
    // Within each bucket, prefer photos with more tags (more analysed)
    const sorted = [...bPhotos].sort((a, b) => b.tag_count - a.tag_count);
    const selected = sorted.slice(0, quota);
    selected.forEach(p => result.push(p.id));
    remaining -= selected.length;
  });

  return result.slice(0, maxPhotos);
}

// ── US-074: Periodos analizables ──────────────────────────────────────────────

export interface AnalysablePeriod {
  period: string;
  type: 'month' | 'year';
  photoCount: number;
}

export function getAnalysablePeriods(): AnalysablePeriod[] {
  const db = getDb();

  const months = db.prepare(`
    SELECT strftime('%Y-%m', taken_at) AS period, COUNT(*) AS photo_count
    FROM photos
    WHERE taken_at IS NOT NULL
    GROUP BY period
    ORDER BY period ASC
  `).all() as { period: string; photo_count: number }[];

  const years = db.prepare(`
    SELECT strftime('%Y', taken_at) AS period, COUNT(*) AS photo_count
    FROM photos
    WHERE taken_at IS NOT NULL
    GROUP BY period
    ORDER BY period ASC
  `).all() as { period: string; photo_count: number }[];

  const result: AnalysablePeriod[] = [];
  for (const m of months) result.push({ period: m.period, type: 'month', photoCount: m.photo_count });
  for (const y of years) result.push({ period: y.period, type: 'year', photoCount: y.photo_count });

  return result;
}

// ── US-075: Bootstrap state ───────────────────────────────────────────────────

export interface BootstrapRow {
  period: string;
  type: 'historical_sample' | 'full';
  status: 'pending' | 'in_progress' | 'done';
  processed_at: string | null;
  photo_count: number;
  sample_count: number;
}

export function getBootstrapRows(): BootstrapRow[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM style_analysis_bootstrap ORDER BY period ASC`).all() as BootstrapRow[];
}

export function getPendingBootstrapRows(): BootstrapRow[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM style_analysis_bootstrap WHERE status IN ('pending','in_progress') ORDER BY period ASC`
  ).all() as BootstrapRow[];
}

export function updateBootstrapRow(period: string, update: Partial<Pick<BootstrapRow, 'status' | 'processed_at' | 'sample_count'>>): void {
  const db = getDb();
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  if (update.status !== undefined) { sets.push('status = ?'); vals.push(update.status); }
  if (update.processed_at !== undefined) { sets.push('processed_at = ?'); vals.push(update.processed_at); }
  if (update.sample_count !== undefined) { sets.push('sample_count = ?'); vals.push(update.sample_count); }
  if (sets.length === 0) return;
  vals.push(period);
  db.prepare(`UPDATE style_analysis_bootstrap SET ${sets.join(', ')} WHERE period = ?`).run(...vals);
}

export function getBootstrapProgress(): BootstrapProgress {
  const db = getDb();
  const row = db.prepare(`
    SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done
    FROM style_analysis_bootstrap
  `).get() as { total: number; done: number };
  const total = row.total ?? 0;
  const done = row.done ?? 0;
  return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function initBootstrapIfEmpty(): void {
  const db = getDb();
  const count = (db.prepare(`SELECT COUNT(*) AS n FROM style_analysis_bootstrap`).get() as { n: number }).n;
  if (count > 0) return;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 24);
  const cutoffStr = cutoff.toISOString().substring(0, 7);

  const months = db.prepare(`
    SELECT strftime('%Y-%m', taken_at) AS period, COUNT(*) AS photo_count
    FROM photos WHERE taken_at IS NOT NULL
    GROUP BY period ORDER BY period ASC
  `).all() as { period: string; photo_count: number }[];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO style_analysis_bootstrap (period, type, status, photo_count, sample_count)
    VALUES (?, ?, 'pending', ?, 0)
  `);

  // Historical years (before cutoff): one row per year
  const historicalYears = new Set<string>();
  for (const m of months) {
    if (m.period < cutoffStr) historicalYears.add(m.period.substring(0, 4));
  }

  // Recent months (last 24 months): per month, newest first
  const recentMonths = months.filter(m => m.period >= cutoffStr).reverse();

  db.transaction(() => {
    for (const year of Array.from(historicalYears).sort()) {
      const yearCount = months.filter(m => m.period.startsWith(year)).reduce((s, m) => s + m.photo_count, 0);
      insert.run(year, 'historical_sample', yearCount);
    }
    for (const m of recentMonths) {
      insert.run(m.period, 'full', m.photo_count);
    }
  })();
}

// ── US-076: Style profiles ────────────────────────────────────────────────────

interface StyleProfileRow {
  id: number;
  period: string;
  type: 'monthly' | 'annual_historical';
  profile_text: string;
  highlights_json: string;
  trend: string | null;
  period_summary_json: string | null;
  created_at: string;
  updated_at: string;
}

function rowToProfile(row: StyleProfileRow): StyleProfile {
  let highlights: string[] = [];
  try { highlights = JSON.parse(row.highlights_json); } catch { /* ignore */ }
  let periodSummary: PeriodStyleSummary | null = null;
  try { periodSummary = row.period_summary_json ? JSON.parse(row.period_summary_json) : null; } catch { /* ignore */ }
  return {
    id: row.id,
    period: row.period,
    type: row.type,
    profileText: row.profile_text,
    highlights,
    trend: row.trend,
    periodSummary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getStyleProfile(period: string): StyleProfile | undefined {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM style_profiles WHERE period = ?`).get(period) as StyleProfileRow | undefined;
  return row ? rowToProfile(row) : undefined;
}

export function getLatestProfiles(n: number, type?: 'monthly' | 'annual_historical'): StyleProfile[] {
  const db = getDb();
  const rows = type
    ? db.prepare(`SELECT * FROM style_profiles WHERE type = ? ORDER BY period DESC LIMIT ?`).all(type, n) as StyleProfileRow[]
    : db.prepare(`SELECT * FROM style_profiles ORDER BY period DESC LIMIT ?`).all(n) as StyleProfileRow[];
  return rows.map(rowToProfile);
}

export function upsertStyleProfile(profile: Omit<StyleProfile, 'id' | 'createdAt' | 'updatedAt'>): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO style_profiles (period, type, profile_text, highlights_json, trend, period_summary_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(period) DO UPDATE SET
      profile_text = excluded.profile_text,
      highlights_json = excluded.highlights_json,
      trend = excluded.trend,
      period_summary_json = excluded.period_summary_json,
      updated_at = excluded.updated_at
  `).run(
    profile.period,
    profile.type,
    profile.profileText,
    JSON.stringify(profile.highlights),
    profile.trend,
    profile.periodSummary ? JSON.stringify(profile.periodSummary) : null,
  );
}

// ── US-076: Pending signals ───────────────────────────────────────────────────

export function accumulatePendingSignals(sinceIso: string): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO style_pending_signals (photo_id, period)
    SELECT id, strftime('%Y-%m', taken_at)
    FROM photos
    WHERE taken_at IS NOT NULL AND scanned_at >= ?
  `).run(sinceIso);
}

export function consumePendingSignalsForMonth(month: string): number[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT DISTINCT photo_id FROM style_pending_signals WHERE period = ?`
  ).all(month) as { photo_id: number }[];
  db.prepare(`DELETE FROM style_pending_signals WHERE period = ?`).run(month);
  return rows.map(r => r.photo_id);
}

export function getLastDailyRun(): string | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT value FROM style_config WHERE key = 'last_daily_run'`
  ).get() as { value: string } | undefined;
  return row?.value ?? null;
}

export function setLastDailyRun(isoDate: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO style_config (key, value) VALUES ('last_daily_run', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(isoDate);
}
