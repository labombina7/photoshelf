import { getDb } from '@/lib/db';

export interface StatsOverview {
  total: number;
  sizeBytes: number;
  minYear: number | null;
  maxYear: number | null;
  eventCount: number;
  tagCount: number;
  themeCount: number;
  withGps: number;
  favorites: number;
}

export function getStatsOverview(): StatsOverview {
  const db = getDb();

  const ov = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(size_bytes), 0) as size_bytes,
      MIN(year) as min_year,
      MAX(year) as max_year,
      COUNT(DISTINCT year || '|' || event) as event_count,
      COALESCE(SUM(CASE WHEN is_favorite   = 1    THEN 1 ELSE 0 END), 0) as favorites,
      COALESCE(SUM(CASE WHEN gps_lat IS NOT NULL   THEN 1 ELSE 0 END), 0) as with_gps
    FROM photos
  `).get() as {
    total: number; size_bytes: number; min_year: number | null; max_year: number | null;
    event_count: number; favorites: number; with_gps: number;
  };

  const tagCount   = (db.prepare('SELECT COUNT(*) as c FROM tags').get()   as { c: number }).c;
  const themeCount = (db.prepare('SELECT COUNT(*) as c FROM themes').get() as { c: number }).c;

  return {
    total:      ov.total,
    sizeBytes:  ov.size_bytes,
    minYear:    ov.min_year,
    maxYear:    ov.max_year,
    eventCount: ov.event_count,
    tagCount,
    themeCount,
    withGps:    ov.with_gps,
    favorites:  ov.favorites,
  };
}

export function getPhotosByYear(): { year: number; count: number }[] {
  return getDb().prepare(
    'SELECT year, COUNT(*) as count FROM photos GROUP BY year ORDER BY year'
  ).all() as { year: number; count: number }[];
}

export function getPhotosByMonth(year: number): { month: number; count: number }[] {
  return getDb().prepare(`
    SELECT CAST(strftime('%m', taken_at) AS INTEGER) as month, COUNT(*) as count
    FROM photos WHERE year = ? AND taken_at IS NOT NULL
    GROUP BY month ORDER BY month
  `).all(year) as { month: number; count: number }[];
}

export function getTopCameras(limit = 6): { camera: string; count: number }[] {
  return getDb().prepare(`
    SELECT camera, COUNT(*) as count FROM photos
    WHERE camera IS NOT NULL AND camera != ''
    GROUP BY camera ORDER BY count DESC LIMIT ?
  `).all(limit) as { camera: string; count: number }[];
}

export function getTopTags(limit = 20): { name: string; aiCount: number; manualCount: number; total: number }[] {
  const rows = getDb().prepare(`
    SELECT t.name,
      SUM(CASE WHEN pt.source = 'ai'     THEN 1 ELSE 0 END) as ai_count,
      SUM(CASE WHEN pt.source = 'manual' THEN 1 ELSE 0 END) as manual_count,
      COUNT(*) as total
    FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id
    GROUP BY t.id ORDER BY total DESC LIMIT ?
  `).all(limit) as { name: string; ai_count: number; manual_count: number; total: number }[];

  return rows.map(t => ({ name: t.name, aiCount: t.ai_count, manualCount: t.manual_count, total: t.total }));
}

export function getPhotosByHour(): { hour: number; count: number }[] {
  return getDb().prepare(`
    SELECT CAST(strftime('%H', taken_at) AS INTEGER) as hour, COUNT(*) as count
    FROM photos WHERE taken_at IS NOT NULL GROUP BY hour ORDER BY hour
  `).all() as { hour: number; count: number }[];
}
