import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { generateProject } from '@/lib/ollama';
import type { ProjectCandidate } from '@/lib/ollama';

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

  const candidates: ProjectCandidate[] = rows.map(r => ({
    id: r.id,
    filename: r.filename,
    year: r.year,
    event: r.event,
    tags: r.tag_list ? r.tag_list.split(',').filter(Boolean) : [],
  }));

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
