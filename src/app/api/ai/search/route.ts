import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { parseSearchQuery, photoMatchesConcept } from '@/lib/ollama';

const PHOTOS_PATH = process.env.PHOTOS_PATH ?? '/photos';
const DEEP_BATCH = 50;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { prompt: rawPrompt, mode, offset = 0 } = await req.json();
  if (!rawPrompt?.trim()) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
  // Sanitize: limit length to prevent prompt injection payloads
  const prompt = String(rawPrompt).trim().slice(0, 200);

  const db = getDb();
  const { year, concept, tags } = await parseSearchQuery(prompt);

  if (mode === 'quick') {
    if (tags.length === 0) {
      return NextResponse.json({ photos: [], concept, year, mode: 'quick' });
    }

    const placeholders = tags.map(() => '?').join(',');
    let sql = `
      SELECT p.id, p.path, p.filename, p.year, p.event, p.taken_at, p.is_favorite
      FROM photos p
      JOIN photo_tags pt ON pt.photo_id = p.id
      JOIN tags t ON t.id = pt.tag_id
      WHERE t.name IN (${placeholders})
    `;
    const params: (string | number)[] = [...tags];
    if (year) { sql += ' AND p.year = ?'; params.push(year); }
    sql += ` GROUP BY p.id HAVING COUNT(DISTINCT t.name) = ${tags.length}`;
    sql += ' ORDER BY p.year DESC, p.event ASC, p.filename ASC LIMIT 200';

    const photos = db.prepare(sql).all(...params);
    return NextResponse.json({ photos, concept, year, mode: 'quick', total: (photos as unknown[]).length });
  }

  // Deep search
  let candidateSql = 'SELECT id, path FROM photos WHERE 1=1';
  const candidateParams: (string | number)[] = [];
  if (year) { candidateSql += ' AND year = ?'; candidateParams.push(year); }
  candidateSql += ' ORDER BY id ASC LIMIT ? OFFSET ?';
  candidateParams.push(DEEP_BATCH, offset);

  const totalSql = year
    ? 'SELECT COUNT(*) as c FROM photos WHERE year = ?'
    : 'SELECT COUNT(*) as c FROM photos';
  const totalParams = year ? [year] : [];
  const totalCandidates = (db.prepare(totalSql).get(...totalParams) as { c: number }).c;

  const candidates = db.prepare(candidateSql).all(...candidateParams) as { id: number; path: string }[];

  const insertTag = db.transaction((pid: number, tagNames: string[]) => {
    for (const name of tagNames) {
      db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name);
      const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: number };
      db.prepare('INSERT OR IGNORE INTO photo_tags (photo_id, tag_id, source) VALUES (?, ?, ?)').run(pid, tag.id, 'ai');
    }
  });

  const matchedIds: number[] = [];

  for (const candidate of candidates) {
    try {
      const isUntagged = !(db.prepare(
        'SELECT 1 FROM photo_tags WHERE photo_id = ? AND source = ? LIMIT 1'
      ).get(candidate.id, 'ai'));

      const { matches, tags: newTags } = await photoMatchesConcept(candidate.path, PHOTOS_PATH, concept);

      if (isUntagged && newTags.length > 0) {
        insertTag(candidate.id, newTags);
      }
      if (matches) matchedIds.push(candidate.id);
    } catch { /* skip on error */ }
  }

  const photos = matchedIds.length > 0
    ? db.prepare(
        `SELECT id, path, filename, year, event, taken_at, is_favorite
         FROM photos WHERE id IN (${matchedIds.map(() => '?').join(',')})
         ORDER BY year DESC, event ASC`
      ).all(...matchedIds)
    : [];

  return NextResponse.json({
    photos,
    concept,
    year,
    mode: 'deep',
    analyzed: candidates.length,
    next_offset: offset + DEEP_BATCH,
    total_candidates: totalCandidates,
    has_more: offset + DEEP_BATCH < totalCandidates,
  });
}
