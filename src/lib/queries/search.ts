import { getDb } from '@/lib/db';

export interface SearchHints {
  tags: string[];
  events: string[];
  smartAlbums: { id: number; name: string }[];
  projects: { id: number; title: string }[];
}

export interface TagSuggestion {
  name: string;
  count: number;
}

export interface EventSuggestion {
  name: string;
  year: number;
  count: number;
}

export interface SmartAlbumSuggestion {
  id: number;
  name: string;
}

export interface ProjectSuggestion {
  id: number;
  title: string;
}

export interface SearchSuggestions {
  tags: TagSuggestion[];
  events: EventSuggestion[];
  smartAlbums: SmartAlbumSuggestion[];
  projects: ProjectSuggestion[];
}

export interface AiSearchCandidate {
  id: number;
  path: string;
}

export function getSearchHints(catalogId = 1): SearchHints {
  const db = getDb();

  const tags = (
    db.prepare('SELECT name FROM tags ORDER BY name ASC').all() as { name: string }[]
  ).map(r => r.name);

  const events = (
    db.prepare(
      `SELECT DISTINCT event FROM photos
       WHERE event IS NOT NULL AND event != '' AND catalog_id = ?
       ORDER BY event ASC`,
    ).all(catalogId) as { event: string }[]
  ).map(r => r.event);

  const smartAlbums = db.prepare(
    `SELECT id, name FROM smart_albums
     WHERE catalog_id IS NULL OR catalog_id = ?
     ORDER BY name ASC`,
  ).all(catalogId) as { id: number; name: string }[];

  const projects = db.prepare(
    'SELECT id, title FROM projects ORDER BY title ASC',
  ).all() as { id: number; title: string }[];

  return { tags, events, smartAlbums, projects };
}

export function getSearchSuggestions(q: string, catalogId: number): SearchSuggestions {
  const db = getDb();
  const like = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;

  const tags = db.prepare(`
    SELECT t.name, COUNT(pt.photo_id) AS count
    FROM tags t
    JOIN photo_tags pt ON pt.tag_id = t.id
    JOIN photos p ON p.id = pt.photo_id
    WHERE t.name LIKE ? ESCAPE '\\' AND p.catalog_id = ?
    GROUP BY t.id ORDER BY count DESC LIMIT 5
  `).all(like, catalogId) as TagSuggestion[];

  const events = db.prepare(`
    SELECT event AS name, year, COUNT(*) AS count
    FROM photos
    WHERE event LIKE ? ESCAPE '\\' AND catalog_id = ?
      AND event IS NOT NULL AND event != ''
    GROUP BY year, event ORDER BY year DESC, count DESC LIMIT 3
  `).all(like, catalogId) as EventSuggestion[];

  const smartAlbums = db.prepare(`
    SELECT id, name
    FROM smart_albums
    WHERE name LIKE ? ESCAPE '\\'
      AND (catalog_id IS NULL OR catalog_id = ?)
    ORDER BY name ASC LIMIT 3
  `).all(like, catalogId) as SmartAlbumSuggestion[];

  const projects = db.prepare(`
    SELECT id, title
    FROM projects
    WHERE title LIKE ? ESCAPE '\\'
    ORDER BY title ASC LIMIT 3
  `).all(like) as ProjectSuggestion[];

  return { tags, events, smartAlbums, projects };
}

export function getAiSearchCandidates(
  catalogId: number,
  year?: number | null,
  limit = 50,
  offset = 0,
): AiSearchCandidate[] {
  const db = getDb();
  let sql = 'SELECT id, path FROM photos WHERE catalog_id = ?';
  const params: (string | number)[] = [catalogId];
  if (year) { sql += ' AND year = ?'; params.push(year); }
  sql += ' ORDER BY id ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return db.prepare(sql).all(...params) as AiSearchCandidate[];
}

export function countAiSearchCandidates(catalogId: number, year?: number | null): number {
  const db = getDb();
  if (year) {
    return (db.prepare('SELECT COUNT(*) as c FROM photos WHERE catalog_id = ? AND year = ?').get(catalogId, year) as { c: number }).c;
  }
  return (db.prepare('SELECT COUNT(*) as c FROM photos WHERE catalog_id = ?').get(catalogId) as { c: number }).c;
}

export function getAiSearchPhotosByIds(ids: number[]): {
  id: number; path: string; filename: string; year: number;
  event: string; taken_at: string | null; is_favorite: number;
}[] {
  if (ids.length === 0) return [];
  const ph = ids.map(() => '?').join(',');
  return getDb().prepare(
    `SELECT id, path, filename, year, event, taken_at, is_favorite
     FROM photos WHERE id IN (${ph})
     ORDER BY year DESC, event ASC`
  ).all(...ids) as {
    id: number; path: string; filename: string; year: number;
    event: string; taken_at: string | null; is_favorite: number;
  }[];
}
