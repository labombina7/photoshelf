/**
 * US-030 — Lógica de búsqueda unificada
 *
 * Módulo compartido usado tanto por la API GET /api/search
 * como por el Server Component /search (SSR directo, sin HTTP round-trip).
 */

import { getDb } from '@/lib/db';
import { classifyQuery } from './classifier';
import type { ClassifierHints } from './classifier';
import { parseSearchQuery } from '@/lib/ollama';

// ─── Tipos de respuesta ────────────────────────────────────────────────────────

export interface SearchPhotoRow {
  id: number;
  filename: string;
  year: number;
  event: string;
  taken_at: string | null;
  is_favorite: number;
}

export interface TagMatch {
  name: string;
  count: number;
}

export interface EventMatch {
  year: number;
  event: string;
  count: number;
}

export type SearchIntentType = 'year' | 'tag' | 'event' | 'fulltext' | 'ai';

export interface SearchResult {
  intent: SearchIntentType;
  query: string;
  isAI: boolean;
  /** Concept extracted by Ollama (only when isAI: true and different from query) */
  aiConcept?: string;
  photos: SearchPhotoRow[];
  tags: TagMatch[];
  events: EventMatch[];
  total: number;
  duration_ms: number;
}

const PHOTO_LIMIT = 200;
const PHOTO_COLS  = 'id, filename, year, event, taken_at, is_favorite';
const HINTS_TTL_MS = 60_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hintsCache = new Map<number, { data: ClassifierHints; expiresAt: number }>();

function loadHints(catalogId: number): ClassifierHints {
  const cached = hintsCache.get(catalogId);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const db = getDb();
  const tags = (
    db.prepare('SELECT name FROM tags ORDER BY name ASC LIMIT 500').all() as { name: string }[]
  ).map(r => r.name);

  const events = (
    db.prepare(
      `SELECT DISTINCT event FROM photos
       WHERE event IS NOT NULL AND event != '' AND catalog_id = ?
       ORDER BY event ASC`,
    ).all(catalogId) as { event: string }[]
  ).map(r => r.event);

  const data = { tags, events };
  hintsCache.set(catalogId, { data, expiresAt: Date.now() + HINTS_TTL_MS });
  return data;
}

function matchingTags(query: string, catalogId: number): TagMatch[] {
  const like = `%${query.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
  return (
    getDb().prepare(`
      SELECT t.name, COUNT(pt.photo_id) AS count
      FROM tags t
      JOIN photo_tags pt ON pt.tag_id = t.id
      JOIN photos p ON p.id = pt.photo_id
      WHERE t.name LIKE ? ESCAPE '\\' AND p.catalog_id = ?
      GROUP BY t.id ORDER BY count DESC LIMIT 10
    `).all(like, catalogId) as TagMatch[]
  );
}

function matchingEvents(query: string, catalogId: number): EventMatch[] {
  const like = `%${query.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
  return (
    getDb().prepare(`
      SELECT year, event, COUNT(*) AS count
      FROM photos
      WHERE event LIKE ? ESCAPE '\\' AND catalog_id = ?
      GROUP BY year, event ORDER BY year DESC, event ASC LIMIT 10
    `).all(like, catalogId) as EventMatch[]
  );
}

// ─── Estrategias por intent ───────────────────────────────────────────────────

function searchByYear(year: number, catalogId: number): SearchPhotoRow[] {
  return getDb().prepare(
    `SELECT ${PHOTO_COLS} FROM photos WHERE year = ? AND catalog_id = ?
     ORDER BY taken_at ASC, filename ASC LIMIT ${PHOTO_LIMIT}`,
  ).all(year, catalogId) as SearchPhotoRow[];
}

function searchByTag(tagName: string, catalogId: number): SearchPhotoRow[] {
  return getDb().prepare(
    `SELECT ${PHOTO_COLS.split(', ').map(c => `p.${c}`).join(', ')}
     FROM photos p
     JOIN photo_tags pt ON pt.photo_id = p.id
     JOIN tags t ON t.id = pt.tag_id
     WHERE t.name = ? COLLATE NOCASE AND p.catalog_id = ?
     ORDER BY p.taken_at ASC, p.filename ASC LIMIT ${PHOTO_LIMIT}`,
  ).all(tagName, catalogId) as SearchPhotoRow[];
}

function searchByEvent(eventName: string, catalogId: number): SearchPhotoRow[] {
  return getDb().prepare(
    `SELECT ${PHOTO_COLS} FROM photos WHERE event = ? AND catalog_id = ?
     ORDER BY taken_at ASC, filename ASC LIMIT ${PHOTO_LIMIT}`,
  ).all(eventName, catalogId) as SearchPhotoRow[];
}

function searchFulltext(query: string, catalogId: number): SearchPhotoRow[] {
  const like = `%${query.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
  return getDb().prepare(
    `SELECT ${PHOTO_COLS} FROM photos
     WHERE catalog_id = ?
       AND (filename LIKE ? ESCAPE '\\' OR event LIKE ? ESCAPE '\\' OR path LIKE ? ESCAPE '\\')
     ORDER BY taken_at DESC, filename ASC LIMIT ${PHOTO_LIMIT}`,
  ).all(catalogId, like, like, like) as SearchPhotoRow[];
}

async function searchAI(query: string, catalogId: number): Promise<{ photos: SearchPhotoRow[]; concept: string }> {
  const { year, tags, concept } = await parseSearchQuery(query);

  if (tags.length === 0 && !year) return { photos: [], concept };

  const db = getDb();
  let sql: string;
  let params: (string | number)[];

  const colList = PHOTO_COLS.split(', ').map(c => `p.${c}`).join(', ');

  if (tags.length > 0) {
    const ph = tags.map(() => '?').join(',');
    sql = `
      SELECT ${colList}
      FROM photos p
      JOIN photo_tags pt ON pt.photo_id = p.id
      JOIN tags t ON t.id = pt.tag_id
      WHERE t.name IN (${ph}) AND p.catalog_id = ?`;
    params = [...tags, catalogId];
    if (year) { sql += ' AND p.year = ?'; params.push(year); }
    sql += ` GROUP BY p.id HAVING COUNT(DISTINCT t.name) = ${tags.length}`;
  } else {
    sql = `SELECT ${colList} FROM photos p WHERE p.catalog_id = ?`;
    params = [catalogId];
    if (year) { sql += ' AND p.year = ?'; params.push(year); }
  }

  sql += ` ORDER BY p.taken_at ASC, p.filename ASC LIMIT ${PHOTO_LIMIT}`;
  return { photos: db.prepare(sql).all(...params) as SearchPhotoRow[], concept };
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function executeSearch(
  query: string,
  catalogId = 1,
  forceAI = false,
): Promise<SearchResult> {
  const start = Date.now();
  const raw   = query.trim().slice(0, 200);
  const hints = loadHints(catalogId);
  const intent = forceAI ? { type: 'ai' as const } : classifyQuery(raw, hints);

  let photos: SearchPhotoRow[] = [];
  let isAI = false;
  let aiConcept: string | undefined;
  let tags: TagMatch[] = [];
  let events: EventMatch[] = [];

  switch (intent.type) {
    case 'year':
      photos = searchByYear(intent.year, catalogId);
      break;

    case 'tag':
      photos = searchByTag(intent.name, catalogId);
      // Also surface matching tags as chips
      tags = [{ name: intent.name, count: photos.length }];
      break;

    case 'event':
      photos = searchByEvent(intent.name, catalogId);
      events = [{ year: photos[0]?.year ?? 0, event: intent.name, count: photos.length }];
      break;

    case 'fulltext':
      photos = searchFulltext(raw, catalogId);
      tags   = matchingTags(raw, catalogId);
      events = matchingEvents(raw, catalogId);
      break;

    case 'ai': {
      try {
        const aiResult = await searchAI(raw, catalogId);
        photos    = aiResult.photos;
        aiConcept = aiResult.concept !== raw ? aiResult.concept : undefined;
        isAI      = true;
      } catch {
        // Ollama no disponible — fallback a fulltext
        photos = searchFulltext(raw, catalogId);
        tags   = matchingTags(raw, catalogId);
        events = matchingEvents(raw, catalogId);
      }
      break;
    }
  }

  return {
    intent: intent.type,
    query: raw,
    isAI,
    photos,
    tags,
    events,
    total: photos.length,
    aiConcept,
    duration_ms: Date.now() - start,
  };
}
