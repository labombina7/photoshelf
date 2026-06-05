import { getDb } from '@/lib/db';
import type { AlbumRule } from '@/lib/smartAlbumQuery';

export interface AlbumCluster {
  name: string;
  dateFrom: string;
  dateTo: string;
  photoCount: number;
  rules: AlbumRule[];
}

const GAP_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

const SPANISH_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function suggestName(dateFrom: string, dateTo: string): string {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const diffDays = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  const year = from.getFullYear();
  const month = from.getMonth();
  const day = from.getDate();

  // Known holidays (approximate)
  if (month === 11 && day >= 24 && day <= 26) return `Navidad ${year}`;
  if (month === 0 && day >= 5 && day <= 6) return `Reyes ${year}`;
  if (month === 0 && day >= 1 && day <= 3) return `Año Nuevo ${year}`;

  const monthName = SPANISH_MONTHS[month];
  const capitalMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  if (diffDays <= 3) return `${capitalMonth} ${year}`;
  if (from.getMonth() === to.getMonth()) return `${capitalMonth} ${year}`;

  const toMonth = SPANISH_MONTHS[to.getMonth()];
  const capTo = toMonth.charAt(0).toUpperCase() + toMonth.slice(1);
  return `${capitalMonth}–${capTo} ${year}`;
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

  const clusters: { start: string; end: string; count: number }[] = [];
  let clusterStart = rows[0].taken_at;
  let clusterEnd = rows[0].taken_at;
  let count = 1;

  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].taken_at).getTime();
    const curr = new Date(rows[i].taken_at).getTime();
    if (curr - prev > GAP_MS) {
      clusters.push({ start: clusterStart, end: clusterEnd, count });
      clusterStart = rows[i].taken_at;
      count = 1;
    } else {
      count++;
    }
    clusterEnd = rows[i].taken_at;
  }
  clusters.push({ start: clusterStart, end: clusterEnd, count });

  return clusters.map(c => {
    const dateFrom = c.start.slice(0, 10);
    const dateTo = c.end.slice(0, 10);
    const endOfDay = `${dateTo}T23:59:59.999Z`;

    const rules: AlbumRule[] = [
      { field: 'taken_after', op: 'gte', value: c.start },
      { field: 'taken_before', op: 'lte', value: endOfDay },
    ];

    return {
      name: suggestName(dateFrom, dateTo),
      dateFrom,
      dateTo,
      photoCount: c.count,
      rules,
    };
  });
}
