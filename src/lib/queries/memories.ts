import { getDb } from '@/lib/db';
import type { Photo } from '@/lib/types';

export interface MemoryYear {
  year: number;
  count: number;
  photos: Photo[];
}

export interface MemoriesResult {
  date: string; // MM-DD
  years: MemoryYear[];
  total: number;
}

/**
 * Returns photos taken on the same month-day in previous years.
 * date format: "MM-DD" (e.g. "06-01")
 */
export function getMemoriesForDate(date: string, catalogId = 1): MemoriesResult {
  const db = getDb();
  const currentYear = new Date().getFullYear();

  const rows = db.prepare(`
    SELECT *
    FROM photos
    WHERE catalog_id = ?
      AND strftime('%m-%d', taken_at) = ?
      AND CAST(strftime('%Y', taken_at) AS INTEGER) < ?
    ORDER BY taken_at DESC
  `).all(catalogId, date, currentYear) as Photo[];

  const byYear = new Map<number, Photo[]>();
  for (const photo of rows) {
    const y = photo.taken_at ? parseInt(photo.taken_at.slice(0, 4), 10) : 0;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(photo);
  }

  const years: MemoryYear[] = Array.from(byYear.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, photos]) => ({ year, count: photos.length, photos }));

  return { date, years, total: rows.length };
}

/** Returns a compact preview (max 5 photos) for the banner. */
export function getMemoriesBannerData(catalogId = 1): {
  hasMemories: boolean;
  total: number;
  yearList: number[];
  previewPhotos: Pick<Photo, 'id' | 'filename'>[];
} {
  const db = getDb();
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const date = `${mm}-${dd}`;
  const currentYear = today.getFullYear();

  const rows = db.prepare(`
    SELECT id, filename, taken_at
    FROM photos
    WHERE catalog_id = ?
      AND strftime('%m-%d', taken_at) = ?
      AND CAST(strftime('%Y', taken_at) AS INTEGER) < ?
    ORDER BY taken_at DESC
    LIMIT 20
  `).all(catalogId, date, currentYear) as (Pick<Photo, 'id' | 'filename'> & { taken_at: string | null })[];

  if (rows.length === 0) {
    return { hasMemories: false, total: 0, yearList: [], previewPhotos: [] };
  }

  const yearSet = new Set<number>();
  for (const r of rows) {
    if (r.taken_at) yearSet.add(parseInt(r.taken_at.slice(0, 4), 10));
  }

  return {
    hasMemories: true,
    total: rows.length,
    yearList: Array.from(yearSet).sort((a, b) => b - a),
    previewPhotos: rows.slice(0, 5).map(r => ({ id: r.id, filename: r.filename })),
  };
}
