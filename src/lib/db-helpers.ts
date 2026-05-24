import type Database from 'better-sqlite3';

/**
 * Upsert AI-generated tags for a photo in a single transaction.
 *
 * Centralises the repeated inline `insertTag` pattern that appeared across
 * all classify routes and folderWatcher.
 */
export function upsertAiTags(db: Database.Database, photoId: number, tags: string[]): void {
  if (tags.length === 0) return;
  const run = db.transaction((pid: number, tagNames: string[]) => {
    for (const name of tagNames) {
      db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name);
      const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: number };
      db.prepare('INSERT OR IGNORE INTO photo_tags (photo_id, tag_id, source) VALUES (?, ?, ?)').run(pid, tag.id, 'ai');
    }
  });
  run(photoId, tags);
}

// ─── Photo filter builder ──────────────────────────────────────────────────

export interface PhotoFilters {
  year?: string | null;
  event?: string | null;
  theme?: string | null;
  tag?: string | null;
  favorite?: string | null;
  untagged?: string | null;
  q?: string | null;
}

/**
 * SQL fragments + positional params for filtering the `photos p` table.
 *
 * Usage pattern:
 *   const { joinSql, whereSql, params } = buildPhotoFilter(filters);
 *   const sql = `SELECT ... FROM photos p ${joinSql} WHERE 1=1 ${whereSql} ...`;
 *   db.prepare(sql).all(...params, ...extraParams);
 *
 * Param ordering: JOIN params always precede WHERE params, matching the
 * left-to-right order of `?` placeholders in the generated SQL.
 */
export interface PhotoFilterResult {
  /** JOIN / LEFT JOIN clauses (newline-separated, may be empty string). */
  joinSql: string;
  /** AND conditions (each prefixed with "AND ", newline-separated, may be empty). */
  whereSql: string;
  /** Positional params: JOIN params first, then WHERE params. */
  params: (string | number)[];
}

export function buildPhotoFilter(filters: PhotoFilters): PhotoFilterResult {
  const { year, event, theme, tag, favorite, untagged, q } = filters;

  const joinParts: string[] = [];
  const joinParams: (string | number)[] = [];
  const whereParts: string[] = [];
  const whereParams: (string | number)[] = [];

  // ── JOIN clauses — params must come before WHERE params ──────────────────

  if (theme) {
    joinParts.push('JOIN photo_themes _pth ON _pth.photo_id = p.id AND _pth.theme_id = ?');
    joinParams.push(parseInt(theme, 10));
  }

  if (tag) {
    joinParts.push(
      'JOIN photo_tags _ptag ON _ptag.photo_id = p.id' +
      ' JOIN tags _ttag ON _ttag.id = _ptag.tag_id AND _ttag.name = ?'
    );
    joinParams.push(tag);
  }

  if (untagged) {
    // LEFT JOIN so we can filter to photos with no tags via IS NULL
    joinParts.push('LEFT JOIN photo_tags _ptun ON _ptun.photo_id = p.id');
  }

  if (q) {
    joinParts.push(
      'LEFT JOIN photo_tags _ptq ON _ptq.photo_id = p.id' +
      ' LEFT JOIN tags _tq ON _tq.id = _ptq.tag_id'
    );
  }

  // ── WHERE conditions ──────────────────────────────────────────────────────

  if (year)     { whereParts.push('p.year = ?');       whereParams.push(parseInt(year, 10)); }
  if (event)    { whereParts.push('p.event = ?');      whereParams.push(event); }
  if (favorite) { whereParts.push('p.is_favorite = 1'); }
  if (untagged) { whereParts.push('_ptun.photo_id IS NULL'); }
  if (q) {
    whereParts.push('(p.filename LIKE ? OR p.event LIKE ? OR _tq.name LIKE ?)');
    const like = `%${q}%`;
    whereParams.push(like, like, like);
  }

  return {
    joinSql:  joinParts.join('\n  '),
    whereSql: whereParts.map(c => `AND ${c}`).join('\n  '),
    params:   [...joinParams, ...whereParams],
  };
}
