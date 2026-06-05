import fs from 'fs';
import path from 'path';
import { getDb } from './db';
import { BACKUP_PATH, BACKUP_MAX_KEEP } from './config';
import { updateLastBackup } from './queries/backup';

export interface BackupResult {
  db_path: string;
  json_path: string;
  db_size_bytes: number;
  duration_ms: number;
}

export async function runBackup(): Promise<BackupResult> {
  const start = Date.now();

  if (!fs.existsSync(BACKUP_PATH)) {
    fs.mkdirSync(BACKUP_PATH, { recursive: true });
  }

  const stamp = new Date().toISOString().replace(/[-:T]/g, match => {
    if (match === 'T') return '-';
    if (match === ':') return '';
    return match;
  }).slice(0, 15); // YYYYMMdd-HHmmss

  const dbDest = path.join(BACKUP_PATH, `photoshelf-${stamp}.db`);
  const jsonDest = path.join(BACKUP_PATH, `photoshelf-${stamp}-tags.json`);

  const db = getDb();

  // Atomic backup — SQLite VACUUM INTO writes a consistent copy without locking the live DB
  db.exec(`VACUUM INTO '${dbDest.replace(/'/g, "''")}'`);

  // Export critical tables as JSON
  const tags = db.prepare(`
    SELECT p.path AS photo_path, t.name AS tag, pt.source
    FROM photo_tags pt
    JOIN photos p ON p.id = pt.photo_id
    JOIN tags t   ON t.id = pt.tag_id
    ORDER BY p.path, t.name
  `).all();

  const themes = db.prepare(`
    SELECT p.path AS photo_path, th.name AS theme
    FROM photo_themes pth
    JOIN photos p  ON p.id = pth.photo_id
    JOIN themes th ON th.id = pth.theme_id
    ORDER BY p.path, th.name
  `).all();

  const projects = db.prepare(`
    SELECT pr.id, pr.title, pr.statement, pr.scope_type, pr.scope_value, pr.created_at,
           json_group_array(json_object('photo_path', p.path, 'position', pp.position))
             FILTER (WHERE p.id IS NOT NULL) AS photos_json
    FROM projects pr
    LEFT JOIN project_photos pp ON pp.project_id = pr.id
    LEFT JOIN photos p          ON p.id = pp.photo_id
    GROUP BY pr.id
    ORDER BY pr.id
  `).all() as Array<Record<string, unknown>>;

  const favorites = db.prepare(`
    SELECT path FROM photos WHERE is_favorite = 1 ORDER BY path
  `).all();

  fs.writeFileSync(jsonDest, JSON.stringify({
    exported_at: new Date().toISOString(),
    photo_tags: tags,
    photo_themes: themes,
    projects: projects.map(pr => ({
      ...pr,
      photos: JSON.parse(pr.photos_json as string ?? '[]'),
      photos_json: undefined,
    })),
    favorites,
  }, null, 2), 'utf-8');

  const dbSize = fs.statSync(dbDest).size;

  updateLastBackup(dbDest);

  rotateBackups();

  return {
    db_path: dbDest,
    json_path: jsonDest,
    db_size_bytes: dbSize,
    duration_ms: Date.now() - start,
  };
}

function rotateBackups() {
  const files = fs.readdirSync(BACKUP_PATH)
    .filter(f => f.startsWith('photoshelf-') && f.endsWith('.db'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_PATH, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const toDelete = files.slice(BACKUP_MAX_KEEP);
  for (const { name } of toDelete) {
    const base = name.replace(/\.db$/, '');
    for (const ext of ['.db', '-tags.json']) {
      const p = path.join(BACKUP_PATH, base + ext);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
}
