import { getDb } from '@/lib/db';
import type { AlbumRule } from '@/lib/smartAlbumQuery';

export interface AlbumCluster {
  name: string;
  dateFrom: string;
  dateTo: string;
  photoCount: number;
  rules: AlbumRule[];
}

// Two photos more than 14 days apart → different event
const GAP_MS = 14 * 24 * 60 * 60 * 1000;

// Clusters with fewer photos than this get merged into adjacent cluster
const MIN_PHOTOS = 5;

const SPANISH_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function suggestName(dateFrom: string, dateTo: string): string {
  const from = new Date(dateFrom + 'T12:00:00Z');
  const to   = new Date(dateTo   + 'T12:00:00Z');
  const year  = from.getFullYear();
  const month = from.getMonth();
  const day   = from.getDate();

  // Known holidays
  if (month === 11 && day >= 24 && day <= 26) return `Navidad ${year}`;
  if (month === 0  && day >= 5  && day <= 6)  return `Reyes ${year}`;
  if (month === 0  && day >= 1  && day <= 3)  return `Año Nuevo ${year}`;

  const fromLabel = SPANISH_MONTHS[month];

  // Same month → "Mes Año"
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return `${fromLabel} ${year}`;
  }

  // Cross-month → "Mes–Mes Año"
  const toLabel = SPANISH_MONTHS[to.getMonth()];
  const toYear  = to.getFullYear();
  if (year === toYear) return `${fromLabel}–${toLabel} ${year}`;
  return `${fromLabel} ${year}–${toLabel} ${toYear}`;
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

  // ── Step 1: raw gap-based split ──────────────────────────────────────────
  const raw: { start: string; end: string; count: number }[] = [];
  let clusterStart = rows[0].taken_at;
  let clusterEnd   = rows[0].taken_at;
  let count = 1;

  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].taken_at).getTime();
    const curr = new Date(rows[i].taken_at).getTime();
    if (curr - prev > GAP_MS) {
      raw.push({ start: clusterStart, end: clusterEnd, count });
      clusterStart = rows[i].taken_at;
      count = 1;
    } else {
      count++;
    }
    clusterEnd = rows[i].taken_at;
  }
  raw.push({ start: clusterStart, end: clusterEnd, count });

  // ── Step 2: merge small clusters into the nearest neighbour ─────────────
  const merged: { start: string; end: string; count: number }[] = [...raw];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < merged.length; i++) {
      if (merged[i].count < MIN_PHOTOS && merged.length > 1) {
        // Merge with previous if available, else with next
        const target = i > 0 ? i - 1 : i + 1;
        const a = merged[Math.min(i, target)];
        const b = merged[Math.max(i, target)];
        merged.splice(Math.min(i, target), 2, {
          start: a.start,
          end:   b.end,
          count: a.count + b.count,
        });
        changed = true;
        break;
      }
    }
  }

  // ── Step 3: same-month clusters → merge ─────────────────────────────────
  let sameMonthChanged = true;
  while (sameMonthChanged) {
    sameMonthChanged = false;
    for (let i = 0; i < merged.length - 1; i++) {
      const a = new Date(merged[i].start);
      const b = new Date(merged[i + 1].start);
      if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
        merged.splice(i, 2, {
          start: merged[i].start,
          end:   merged[i + 1].end,
          count: merged[i].count + merged[i + 1].count,
        });
        sameMonthChanged = true;
        break;
      }
    }
  }

  // ── Step 4: build result ─────────────────────────────────────────────────
  return merged.map(c => {
    const dateFrom = c.start.slice(0, 10);
    const dateTo   = c.end.slice(0, 10);
    const endOfDay = `${dateTo}T23:59:59.999Z`;

    const rules: AlbumRule[] = [
      { field: 'taken_after',  op: 'gte', value: c.start },
      { field: 'taken_before', op: 'lte', value: endOfDay },
    ];

    return { name: suggestName(dateFrom, dateTo), dateFrom, dateTo, photoCount: c.count, rules };
  });
}
