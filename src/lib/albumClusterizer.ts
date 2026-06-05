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

// Dates before this are considered corrupted EXIF (scanned film, bad metadata…)
const MIN_VALID_DATE = '1990-01-01';

function getKnownEvents(excludeCatalogId: number): KnownEvent[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT event,
           MIN(taken_at) as first_at,
           MAX(taken_at) as last_at
    FROM photos
    WHERE catalog_id != ?
      AND taken_at IS NOT NULL
      AND taken_at > ?
      AND event IS NOT NULL AND event != ''
    GROUP BY catalog_id, year, event
    HAVING COUNT(*) >= 3
    ORDER BY first_at ASC
  `).all(excludeCatalogId, MIN_VALID_DATE) as { event: string; first_at: string; last_at: string }[];

  return rows.map(r => ({
    name: cleanEventName(r.event),
    firstAt: r.first_at,
    lastAt:  r.last_at,
  }));
}

function cleanEventName(raw: string): string {
  // Replace separators with spaces
  let name = raw.replace(/[_-]/g, ' ').trim();
  // Strip leading 6-digit (YYYYMM) or 8-digit (YYYYMMDD) numeric prefixes
  name = name.replace(/^\d{6,8}\s*/, '').trim();
  // Collapse multiple spaces
  name = name.replace(/\s+/g, ' ');
  return name || raw; // fallback to original if empty after cleaning
}

// Expand event window by N days on each side to catch nearby iPhone photos
const EVENT_MARGIN_MS = 3 * 24 * 60 * 60 * 1000;

// Minimum photos in a cross-catalog matched cluster to be worth creating
const CROSS_MATCH_MIN_PHOTOS = 3;

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

export function clusterPhotos(catalogId: number, useCrossMatch = true): AlbumCluster[] {
  const db = getDb();

  const allPhotos = db.prepare(`
    SELECT id, taken_at
    FROM photos
    WHERE catalog_id = ? AND taken_at IS NOT NULL AND taken_at > ?
    ORDER BY taken_at ASC
  `).all(catalogId, MIN_VALID_DATE) as { id: number; taken_at: string }[];

  if (allPhotos.length === 0) return [];

  const knownEvents = useCrossMatch ? getKnownEvents(catalogId) : [];
  const hasCrossMatches = knownEvents.length > 0;

  // ── Path A: cross-catalog matching ────────────────────────────────────────
  if (hasCrossMatches) {
    const matched = new Set<number>(); // photo IDs already assigned
    const eventClusters: AlbumCluster[] = [];

    for (const ev of knownEvents) {
      const windowStart = new Date(new Date(ev.firstAt).getTime() - EVENT_MARGIN_MS).toISOString();
      const windowEnd   = new Date(new Date(ev.lastAt ).getTime() + EVENT_MARGIN_MS).toISOString();

      const photos = allPhotos.filter(
        p => !matched.has(p.id) && p.taken_at >= windowStart && p.taken_at <= windowEnd
      );
      if (photos.length < CROSS_MATCH_MIN_PHOTOS) continue;

      photos.forEach(p => matched.add(p.id));

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
    const unmatched = allPhotos.filter(p => !matched.has(p.id));
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
