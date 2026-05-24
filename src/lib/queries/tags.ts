import { getDb } from '@/lib/db';
import { upsertAiTags } from '@/lib/db-helpers';
import type { Tag } from '@/lib/types';

export interface TagWithCount {
  name: string;
  count: number;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function listAllTags(): { name: string }[] {
  return getDb().prepare('SELECT name FROM tags ORDER BY name ASC').all() as { name: string }[];
}

export function listTagsWithCounts(catalogId = 1): TagWithCount[] {
  return getDb().prepare(`
    SELECT t.name, COUNT(pt.photo_id) AS count
    FROM tags t
    JOIN photo_tags pt ON pt.tag_id = t.id
    JOIN photos p ON p.id = pt.photo_id
    WHERE p.catalog_id = ?
    GROUP BY t.id ORDER BY count DESC, t.name ASC
  `).all(catalogId) as TagWithCount[];
}

export function listPhotoTags(photoId: number): Tag[] {
  return getDb().prepare(
    'SELECT t.id, t.name, pt.source FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.photo_id = ?'
  ).all(photoId) as Tag[];
}

export function getTagByName(name: string): { id: number } | null {
  return (getDb().prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(name) as { id: number } | undefined) ?? null;
}

export function countPhotosByTag(tagId: number, catalogId = 1): number {
  return (getDb().prepare(`
    SELECT COUNT(DISTINCT pt.photo_id) AS count
    FROM photo_tags pt
    JOIN photos p ON p.id = pt.photo_id
    WHERE pt.tag_id = ? AND p.catalog_id = ?
  `).get(tagId, catalogId) as { count: number }).count;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export function addTagToPhoto(
  photoId: number,
  name: string,
  source: 'manual' | 'ai' = 'manual',
): { id: number; name: string; source: string } {
  const db = getDb();
  const tagName = name.trim().toLowerCase();
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tagName);
  const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName) as { id: number };
  db.prepare('INSERT OR IGNORE INTO photo_tags (photo_id, tag_id, source) VALUES (?, ?, ?)').run(photoId, tag.id, source);
  return { id: tag.id, name: tagName, source };
}

export function removeTagFromPhoto(photoId: number, name: string): void {
  getDb().prepare(`
    DELETE FROM photo_tags
    WHERE photo_id = ?
    AND tag_id = (SELECT id FROM tags WHERE name = ? COLLATE NOCASE)
  `).run(photoId, name);
}

/** Upsert AI-generated tags — thin wrapper around the db-helper. */
export { upsertAiTags };
