import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { generateProject } from '@/lib/ollama';
import type { ProjectCandidate } from '@/lib/ollama';

export const maxDuration = 300; // 5 min — Ollama needs time with large prompts

interface Candidate {
  id: number; filename: string; year: number; event: string; tags: string[];
}

function smartSample(all: Candidate[], max: number): Candidate[] {
  // 1. Detect dominant tone (b&w vs color) among tagged photos
  const tagged = all.filter(c => c.tags.length > 0);
  const bwCount = tagged.filter(c => c.tags.includes('b&w')).length;
  const colorCount = tagged.filter(c => c.tags.includes('color')).length;
  const dominantTone = bwCount >= colorCount ? 'b&w' : 'color';

  // 2. Filter to dominant tone (only if meaningful — >20% of tagged have tone tags)
  const hasTone = bwCount + colorCount > tagged.length * 0.2;
  const toneFiltered = hasTone
    ? all.filter(c => c.tags.includes(dominantTone) || c.tags.length === 0)
    : all;

  const pool = toneFiltered.length >= max / 2 ? toneFiltered : all;

  // 3. Stratified sample: take proportionally from each event
  const byEvent = new Map<string, Candidate[]>();
  for (const c of pool) {
    const key = `${c.year}|${c.event}`;
    if (!byEvent.has(key)) byEvent.set(key, []);
    byEvent.get(key)!.push(c);
  }

  const events = Array.from(byEvent.entries());
  const result: Candidate[] = [];
  let remaining = max;

  // Proportional allocation per event, tagged photos first within each
  events.forEach(([, photos], i) => {
    const share = Math.max(1, Math.round((photos.length / pool.length) * max));
    const quota = i === events.length - 1 ? remaining : Math.min(share, remaining);
    const sorted = [...photos].sort((a, b) => b.tags.length - a.tags.length);
    result.push(...sorted.slice(0, quota));
    remaining -= Math.min(quota, sorted.length);
  });

  return result.slice(0, max);
}

interface GenerateBody {
  scopeType: 'year' | 'event' | 'theme' | 'all';
  scopeValue?: string;
  count: number;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { scopeType, scopeValue, count = 15 }: GenerateBody = await req.json();
  const db = getDb();

  // Build candidate query based on scope
  let sql = `
    SELECT p.id, p.filename, p.year, p.event,
           GROUP_CONCAT(t.name, ',') as tag_list
    FROM photos p
    LEFT JOIN photo_tags pt ON pt.photo_id = p.id
    LEFT JOIN tags t ON t.id = pt.tag_id
  `;
  const params: (string | number)[] = [];

  if (scopeType === 'year' && scopeValue) {
    sql += ' WHERE p.year = ?';
    params.push(parseInt(scopeValue, 10));
  } else if (scopeType === 'event' && scopeValue) {
    const [year, ...rest] = scopeValue.split('|');
    sql += ' WHERE p.year = ? AND p.event = ?';
    params.push(parseInt(year, 10), rest.join('|'));
  } else if (scopeType === 'theme' && scopeValue) {
    sql += ' JOIN photo_themes pth ON pth.photo_id = p.id WHERE pth.theme_id = ?';
    params.push(parseInt(scopeValue, 10));
  }

  sql += ' GROUP BY p.id ORDER BY p.year DESC, p.event ASC, p.filename ASC';

  const rows = db.prepare(sql).all(...params) as {
    id: number; filename: string; year: number; event: string; tag_list: string | null;
  }[];

  if (rows.length < 3) {
    return NextResponse.json({ error: 'Not enough photos in scope' }, { status: 400 });
  }

  const MAX_CANDIDATES = 150;
  const allCandidates = rows.map(r => ({
    id: r.id,
    filename: r.filename,
    year: r.year,
    event: r.event,
    tags: r.tag_list ? r.tag_list.split(',').filter(Boolean) : [],
  }));

  const candidates: ProjectCandidate[] = allCandidates.length <= MAX_CANDIDATES
    ? allCandidates
    : smartSample(allCandidates, MAX_CANDIDATES);

  const actualCount = Math.min(count, candidates.length);
  const { title, statement, selectedIds } = await generateProject(candidates, actualCount);

  if (selectedIds.length === 0) {
    return NextResponse.json({ error: 'AI could not select photos' }, { status: 500 });
  }

  // Persist project
  const scopeLabel = scopeType === 'year' ? scopeValue
    : scopeType === 'event' ? scopeValue?.split('|').slice(1).join('|')
    : scopeType === 'theme' ? scopeValue
    : null;

  const result = db.prepare(
    'INSERT INTO projects (title, statement, scope_type, scope_value) VALUES (?, ?, ?, ?)'
  ).run(title, statement, scopeType, scopeLabel ?? null);

  const projectId = result.lastInsertRowid as number;

  const insertPhoto = db.prepare(
    'INSERT OR IGNORE INTO project_photos (project_id, photo_id, position) VALUES (?, ?, ?)'
  );
  const insertAll = db.transaction(() => {
    selectedIds.forEach((photoId, pos) => insertPhoto.run(projectId, photoId, pos));
  });
  insertAll();

  return NextResponse.json({ id: projectId, title, statement, photoCount: selectedIds.length });
}
