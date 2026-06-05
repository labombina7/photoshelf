import { getDb } from '@/lib/db';
import type { AlbumRule } from '@/lib/smartAlbumQuery';

export interface AlbumCluster {
  name: string;
  dateFrom: string;
  dateTo: string;
  photoCount: number;
  rules: AlbumRule[];
  source: 'event_match' | 'fallback'; // matched a known event or fallback grouping
}

// ── Cross-catalog event matching ─────────────────────────────────────────────

interface KnownEvent {
  name: string;       // e.g. "Vacaciones-Grecia"
  firstAt: string;    // ISO
  lastAt: string;     // ISO
}

function getKnownEvents(excludeCatalogId: number): KnownEvent[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT event, MIN(taken_at) as first_at, MAX(taken_at) as last_at
    FROM photos
    WHERE catalog_id != ?
      AND taken_at IS NOT NULL
      AND event IS NOT NULL AND event != ''
    GROUP BY catalog_id, year, event
    HAVING COUNT(*) >= 3
    ORDER BY first_at ASC
  `).all(excludeCatalogId) as { event: string; first_at: string; last_at: string }[];

  return rows.map(r => ({
    name: r.event.replace(/-/g, ' '),
    firstAt: r.first_at,
    lastAt:  r.last_at,
  }));
}

// Expand event window by N days on each side to catch nearby iPhone photos
const EVENT_MARGIN_MS = 2 * 24 * 60 * 60 * 1000;

// ── Fallback: contiguous-day grouping for unmatched photos ───────────────────
// Gap larger than this between consecutive unmatched photos → new fallback group
const FALLBACK_GAP_MS = 21 * 24 * 60 * 60 * 1000; // 3 weeks
const FALLBACK_MIN_PHOTOS = 10;

const SPANISH_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function fallbackName(dateFrom: string, dateTo: string): string {
  const from = new Date(dateFrom + 'T12:00:00Z');
  const to   = new Date(dateTo   + 'T12:00:00Z');
  const month = SPANISH_MONTHS[from.getMonth()];
  const year  = from.getFullYear();
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return `${month} ${year}`;
  }
  const toMonth = SPANISH_MONTHS[to.getMonth()];
  const toYear  = to.getFullYear();
  return year === toYear ? `${month}–${toMonth} ${year}` : `${month} ${year}–${toMonth} ${toYear}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function clusterPhotos(catalogId: number): AlbumCluster[] {
  const db = getDb();

  const allPhotos = db.prepare(`
    SELECT taken_at
    FROM photos
    WHERE catalog_id = ? AND taken_at IS NOT NULL
    ORDER BY taken_at ASC
  `).all(catalogId) as { taken_at: string }[];

  if (allPhotos.length === 0) return [];

  const knownEvents = getKnownEvents(catalogId);
  const useCrossMatch = knownEvents.length > 0;

  // ── Path A: cross-catalog matching ────────────────────────────────────────
  if (useCrossMatch) {
    const matched = new Set<string>(); // ISO strings already assigned
    const eventClusters: AlbumCluster[] = [];

    for (const ev of knownEvents) {
      const windowStart = new Date(new Date(ev.firstAt).getTime() - EVENT_MARGIN_MS).toISOString();
      const windowEnd   = new Date(new Date(ev.lastAt ).getTime() + EVENT_MARGIN_MS).toISOString();

      const photos = allPhotos.filter(
        p => p.taken_at >= windowStart && p.taken_at <= windowEnd
      );
      if (photos.length === 0) continue;

      photos.forEach(p => matched.add(p.taken_at));

      const dateFrom = photos[0].taken_at.slice(0, 10);
      const dateTo   = photos[photos.length - 1].taken_at.slice(0, 10);
      const endOfDay = `${dateTo}T23:59:59.999Z`;

      eventClusters.push({
        name:       ev.name,
        dateFrom,
        dateTo,
        photoCount: photos.length,
        source:     'event_match',
        rules: [
          { field: 'taken_after',  op: 'gte', value: photos[0].taken_at },
          { field: 'taken_before', op: 'lte', value: endOfDay },
        ],
      });
    }

    // ── Fallback for unmatched photos ────────────────────────────────────────
    const unmatched = allPhotos.filter(p => !matched.has(p.taken_at));
    const fallbackClusters = buildFallbackClusters(unmatched);

    return [...eventClusters, ...fallbackClusters]
      .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
  }

  // ── Path B: no other catalogs → pure fallback ─────────────────────────────
  return buildFallbackClusters(allPhotos);
}

function buildFallbackClusters(
  photos: { taken_at: string }[]
): AlbumCluster[] {
  if (photos.length === 0) return [];

  // Gap-based grouping with a large threshold (3 weeks)
  const groups: { start: string; end: string; count: number }[] = [];
  let gStart = photos[0].taken_at;
  let gEnd   = photos[0].taken_at;
  let count  = 1;

  for (let i = 1; i < photos.length; i++) {
    const gap = new Date(photos[i].taken_at).getTime() - new Date(photos[i - 1].taken_at).getTime();
    if (gap > FALLBACK_GAP_MS) {
      groups.push({ start: gStart, end: gEnd, count });
      gStart = photos[i].taken_at;
      count = 1;
    } else {
      count++;
    }
    gEnd = photos[i].taken_at;
  }
  groups.push({ start: gStart, end: gEnd, count });

  // Drop tiny groups (< MIN_PHOTOS) — these are isolated stray photos
  return groups
    .filter(g => g.count >= FALLBACK_MIN_PHOTOS)
    .map(g => {
      const dateFrom = g.start.slice(0, 10);
      const dateTo   = g.end.slice(0, 10);
      const endOfDay = `${dateTo}T23:59:59.999Z`;
      return {
        name:       fallbackName(dateFrom, dateTo),
        dateFrom,
        dateTo,
        photoCount: g.count,
        source:     'fallback' as const,
        rules: [
          { field: 'taken_after' as const,  op: 'gte' as const, value: g.start },
          { field: 'taken_before' as const, op: 'lte' as const, value: endOfDay },
        ],
      };
    });
}
