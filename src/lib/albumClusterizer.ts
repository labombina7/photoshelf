import { getDb } from '@/lib/db';
import type { AlbumRule } from '@/lib/smartAlbumQuery';

export interface AlbumCluster {
  name: string;
  dateFrom: string;
  dateTo: string;
  photoCount: number;
  rules: AlbumRule[];
}

// Within a month: gap larger than this → split into two clusters
const INTRA_MONTH_GAP_MS = 10 * 24 * 60 * 60 * 1000; // 10 days
// Sub-cluster must have at least this many photos to be worth splitting
const MIN_SPLIT_PHOTOS = 8;

const SPANISH_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function monthKey(isoDate: string): string {
  // "2026-01-15T..." → "2026-01"
  return isoDate.slice(0, 7);
}

function suggestName(dateFrom: string, dateTo: string, isSubCluster = false): string {
  const from = new Date(dateFrom + 'T12:00:00Z');
  const year  = from.getFullYear();
  const month = from.getMonth();
  const day   = from.getDate();

  // Known holidays — keep specific
  if (month === 11 && day >= 24 && day <= 26) return `Navidad ${year}`;
  if (month === 0  && day >= 5  && day <= 6)  return `Reyes ${year}`;
  if (month === 0  && day >= 1  && day <= 3)  return `Año Nuevo ${year}`;

  const fromLabel = SPANISH_MONTHS[month];
  const to   = new Date(dateTo + 'T12:00:00Z');

  if (!isSubCluster) {
    // Same month → "Mes Año"
    if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
      return `${fromLabel} ${year}`;
    }
    const toLabel = SPANISH_MONTHS[to.getMonth()];
    const toYear  = to.getFullYear();
    if (year === toYear) return `${fromLabel}–${toLabel} ${year}`;
    return `${fromLabel} ${year}–${toLabel} ${toYear}`;
  }

  // Sub-cluster within a month: show day range
  const fromDay = from.getDate();
  const toDay   = to.getDate();
  if (fromDay <= 15 && toDay <= 15) return `Principios de ${fromLabel} ${year}`;
  if (fromDay > 15  && toDay > 15)  return `Finales de ${fromLabel} ${year}`;
  return `${fromLabel} ${year}`;
}

export function clusterPhotos(catalogId: number): AlbumCluster[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT taken_at
    FROM photos
    WHERE catalog_id = ? AND taken_at IS NOT NULL
    ORDER BY taken_at ASC
  `).all(catalogId) as { taken_at: string }[];

  if (rows.length === 0) return [];

  // ── Step 1: group by year+month ──────────────────────────────────────────
  const byMonth = new Map<string, string[]>();
  for (const { taken_at } of rows) {
    const key = monthKey(taken_at);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(taken_at);
  }

  // ── Step 2: within each month, split on large internal gaps ─────────────
  const clusters: { start: string; end: string; count: number; sub: boolean }[] = [];

  for (const [, photos] of byMonth) {
    // photos are already sorted ASC
    const subGroups: { start: string; end: string; count: number }[] = [];
    let sgStart = photos[0];
    let sgEnd   = photos[0];
    let sgCount = 1;

    for (let i = 1; i < photos.length; i++) {
      const gap = new Date(photos[i]).getTime() - new Date(photos[i - 1]).getTime();
      if (gap > INTRA_MONTH_GAP_MS) {
        subGroups.push({ start: sgStart, end: sgEnd, count: sgCount });
        sgStart = photos[i];
        sgCount = 1;
      } else {
        sgCount++;
      }
      sgEnd = photos[i];
    }
    subGroups.push({ start: sgStart, end: sgEnd, count: sgCount });

    // Only split if BOTH halves are big enough — otherwise keep as one month
    const worthy = subGroups.filter(sg => sg.count >= MIN_SPLIT_PHOTOS);
    if (worthy.length >= 2) {
      for (const sg of worthy) {
        clusters.push({ ...sg, sub: true });
      }
      // Tiny sub-groups get merged into the nearest worthy one
      for (const sg of subGroups.filter(sg => sg.count < MIN_SPLIT_PHOTOS)) {
        const nearest = worthy.reduce((best, w) =>
          Math.abs(new Date(w.start).getTime() - new Date(sg.start).getTime()) <
          Math.abs(new Date(best.start).getTime() - new Date(sg.start).getTime()) ? w : best
        );
        const idx = clusters.findIndex(c => c.start === nearest.start);
        if (idx >= 0) {
          clusters[idx].count += sg.count;
          if (sg.end > clusters[idx].end) clusters[idx].end = sg.end;
          if (sg.start < clusters[idx].start) clusters[idx].start = sg.start;
        }
      }
    } else {
      // Whole month as one cluster
      const allPhotos = photos;
      clusters.push({
        start: allPhotos[0],
        end:   allPhotos[allPhotos.length - 1],
        count: allPhotos.length,
        sub:   false,
      });
    }
  }

  // Sort by start date
  clusters.sort((a, b) => a.start.localeCompare(b.start));

  // ── Step 3: build result ─────────────────────────────────────────────────
  return clusters.map(c => {
    const dateFrom = c.start.slice(0, 10);
    const dateTo   = c.end.slice(0, 10);
    const endOfDay = `${dateTo}T23:59:59.999Z`;

    const rules: AlbumRule[] = [
      { field: 'taken_after',  op: 'gte', value: c.start },
      { field: 'taken_before', op: 'lte', value: endOfDay },
    ];

    return {
      name: suggestName(dateFrom, dateTo, c.sub),
      dateFrom,
      dateTo,
      photoCount: c.count,
      rules,
    };
  });
}
