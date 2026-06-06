import { getDb } from '@/lib/db';

export interface ProjectRow {
  id: number;
  title: string;
  statement: string | null;
  scope_type: string;
  scope_value: string | null;
  created_at: number;
  photo_count: number;
  cover_photo_id: number | null;
}

export interface ProjectDetail {
  id: number;
  title: string;
  statement: string | null;
  scope_type: string;
  scope_value: string | null;
  created_at: number;
  photos: ProjectPhoto[];
}

export interface ProjectPhoto {
  id: number;
  filename: string;
  year: number;
  event: string;
  taken_at: string | null;
  camera: string | null;
  position: number;
}

export interface CreateProjectInput {
  title: string;
  statement?: string | null;
  scope_type: string;
  scope_value?: string | null;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function getProjectList(): ProjectRow[] {
  return getDb().prepare(`
    SELECT pr.id, pr.title, pr.statement, pr.scope_type, pr.scope_value, pr.created_at,
           COUNT(pp.photo_id) as photo_count,
           MIN(pp.position) as min_pos,
           (SELECT pp2.photo_id FROM project_photos pp2 WHERE pp2.project_id = pr.id ORDER BY pp2.position ASC LIMIT 1) as cover_photo_id
    FROM projects pr
    LEFT JOIN project_photos pp ON pp.project_id = pr.id
    GROUP BY pr.id
    ORDER BY pr.created_at DESC
  `).all() as ProjectRow[];
}

export function getSidebarProjects(): { id: number; title: string }[] {
  return getDb().prepare('SELECT id, title FROM projects ORDER BY created_at DESC').all() as { id: number; title: string }[];
}

export function getProjectById(id: number): ProjectDetail | null {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Omit<ProjectDetail, 'photos'> | undefined;
  if (!project) return null;

  const photos = db.prepare(`
    SELECT p.id, p.filename, p.year, p.event, p.taken_at, p.camera, pp.position
    FROM project_photos pp
    JOIN photos p ON p.id = pp.photo_id
    WHERE pp.project_id = ?
    ORDER BY pp.position ASC
  `).all(id) as ProjectPhoto[];

  return { ...project, photos };
}

export interface ProjectCandidate {
  id: number;
  filename: string;
  year: number;
  event: string;
  tag_list: string | null;
}

export interface ProjectSearchPhoto {
  id: number;
  filename: string;
  year: number;
  event: string;
  taken_at: string | null;
  is_favorite: number;
}

/**
 * Devuelve las fotos de un proyecto en formato compatible con SearchPhotoRow.
 * Usado por el motor de búsqueda (US-073).
 */
export function getProjectSearchPhotos(projectId: number, limit = 200): ProjectSearchPhoto[] {
  return getDb().prepare(`
    SELECT p.id, p.filename, p.year, p.event, p.taken_at, p.is_favorite
    FROM project_photos pp
    JOIN photos p ON p.id = pp.photo_id
    WHERE pp.project_id = ?
    ORDER BY pp.position ASC
    LIMIT ?
  `).all(projectId, limit) as ProjectSearchPhoto[];
}

export function getProjectCandidates(
  scopeType: 'year' | 'event' | 'theme' | 'all',
  scopeValue?: string,
): ProjectCandidate[] {
  const db = getDb();
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
  return db.prepare(sql).all(...params) as ProjectCandidate[];
}

// ── Write ─────────────────────────────────────────────────────────────────────

export function createProject(input: CreateProjectInput): number {
  const result = getDb().prepare(
    'INSERT INTO projects (title, statement, scope_type, scope_value) VALUES (?, ?, ?, ?)'
  ).run(input.title, input.statement ?? null, input.scope_type, input.scope_value ?? null);
  return result.lastInsertRowid as number;
}

export function setProjectPhotos(projectId: number, photoIds: number[]): void {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO project_photos (project_id, photo_id, position) VALUES (?, ?, ?)'
  );
  db.transaction(() => {
    photoIds.forEach((photoId, pos) => insert.run(projectId, photoId, pos));
  })();
}

export function updateProject(id: number, data: { title?: string; statement?: string; photoIds?: number[] }): void {
  const db = getDb();
  if (data.title !== undefined) {
    db.prepare('UPDATE projects SET title = ? WHERE id = ?').run(data.title, id);
  }
  if (data.statement !== undefined) {
    db.prepare('UPDATE projects SET statement = ? WHERE id = ?').run(data.statement, id);
  }
  if (data.photoIds) {
    db.transaction(() => {
      db.prepare('DELETE FROM project_photos WHERE project_id = ?').run(id);
      const insert = db.prepare(
        'INSERT OR IGNORE INTO project_photos (project_id, photo_id, position) VALUES (?, ?, ?)'
      );
      data.photoIds!.forEach((photoId, pos) => insert.run(id, photoId, pos));
    })();
  }
}

export function deleteProject(id: number): void {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
}
