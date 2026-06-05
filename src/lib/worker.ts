import { getDb } from './db';
import { classifyPhoto } from './ollama';
import { generateProject } from './ollama';
import { upsertAiTags } from './db-helpers';
import { CLASSIFY_BATCH_SIZE } from './config';
import { getNextJob, updateJob, purgeOldJobs, type JobRow } from './queries/jobs';
import { getProjectCandidates, createProject, setProjectPhotos } from './queries/projects';

interface ClassifyPayload {
  type: 'classify_year' | 'classify_batch';
  year?: number;
  event?: string;
  force: boolean;
  catalogId: number;
  photosRoot: string;
  originUrl: string;
}

interface GenerateProjectPayload {
  type: 'generate_project';
  scopeType: 'year' | 'event' | 'theme' | 'all';
  scopeValue?: string;
  count: number;
  tone?: string;
  styles?: string[];
  tags?: string[];
  catalogId: number;
  originUrl: string;
}

type JobPayload = ClassifyPayload | GenerateProjectPayload;

const g = globalThis as typeof globalThis & { __photoshelf_worker_running?: boolean };

export function ensureWorkerRunning(): void {
  if (g.__photoshelf_worker_running) return;
  g.__photoshelf_worker_running = true;
  workerLoop().catch((err) => {
    console.error('[worker] Fatal error, will retry in 5s:', err);
    g.__photoshelf_worker_running = false;
    setTimeout(ensureWorkerRunning, 5_000);
  });
}

async function workerLoop(): Promise<void> {
  while (true) {
    const job = getNextJob();
    if (!job) {
      await sleep(3_000);
      continue;
    }
    await runJob(job);
  }
}

async function runJob(job: JobRow): Promise<void> {
  const startedAt = new Date().toISOString();
  updateJob(job.id, { status: 'in_progress', started_at: startedAt });

  try {
    const payload = JSON.parse(job.payload) as JobPayload;
    if (payload.type === 'classify_year' || payload.type === 'classify_batch') {
      await runClassifyJob(job, payload as ClassifyPayload, startedAt);
    } else if (payload.type === 'generate_project') {
      await runGenerateProjectJob(job, payload as GenerateProjectPayload);
    } else {
      throw new Error(`Unknown job type: ${(payload as JobPayload).type}`);
    }
    purgeOldJobs();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[worker] Unexpected error in job ${job.id}:`, msg);
    updateJob(job.id, { status: 'failed', error_last: msg });
  }
}

async function runClassifyJob(job: JobRow, payload: ClassifyPayload, startedAt: string): Promise<void> {
  const db = getDb();
  const { force, catalogId, photosRoot } = payload;

  const params: (string | number)[] = [catalogId];
  let sql = `SELECT p.id, p.path, p.event FROM photos p WHERE p.catalog_id = ?`;

  if (payload.year !== undefined) { sql += ' AND p.year = ?'; params.push(payload.year); }
  if (payload.event)              { sql += ' AND p.event = ?'; params.push(payload.event); }

  if (!force) {
    sql += ` AND NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id AND pt.source = 'ai')`;
  } else {
    sql += ` AND NOT EXISTS (
      SELECT 1 FROM photo_tags pt
      WHERE pt.photo_id = p.id AND pt.source = 'ai' AND pt.created_at >= ?
    )`;
    params.push(startedAt);
  }
  sql += ' ORDER BY p.year ASC, p.event ASC, p.filename ASC';

  const photos = db.prepare(sql).all(...params) as { id: number; path: string; event: string }[];
  updateJob(job.id, { total: job.processed + photos.length });

  const deleteAiTags = db.prepare(`DELETE FROM photo_tags WHERE photo_id = ? AND source = 'ai'`);
  let processed = job.processed;
  let errorCount = job.error_count;

  for (let i = 0; i < photos.length; i += CLASSIFY_BATCH_SIZE) {
    const current = db.prepare(`SELECT status FROM job_queue WHERE id = ?`).get(job.id) as { status: string } | undefined;
    if (current?.status === 'cancelled') return;

    const batch = photos.slice(i, i + CLASSIFY_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (photo) => {
        if (force) deleteAiTags.run(photo.id);
        const tags = await classifyPhoto(photo.path, photosRoot);
        upsertAiTags(db, photo.id, tags);
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        processed++;
      } else {
        errorCount++;
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error(`[worker] Classify error in job ${job.id}:`, msg);
        updateJob(job.id, { error_last: msg });
      }
    }
    updateJob(job.id, { processed, error_count: errorCount });
  }

  updateJob(job.id, { status: 'completed' });
}

async function runGenerateProjectJob(job: JobRow, payload: GenerateProjectPayload): Promise<void> {
  const { scopeType, scopeValue, count, tone, styles, tags: filterTags } = payload;

  updateJob(job.id, { total: 1 });

  const rows = getProjectCandidates(scopeType, scopeValue);
  if (rows.length < 3) throw new Error('Not enough photos in scope');

  let candidates = rows.map(r => ({
    id: r.id, filename: r.filename, year: r.year, event: r.event,
    tags: r.tag_list ? r.tag_list.split(',').filter(Boolean) : [],
  }));

  if (tone || filterTags?.length) {
    candidates = candidates.filter(c => {
      if (tone && !c.tags.includes(tone)) return false;
      if (filterTags?.length && !filterTags.every(t => c.tags.includes(t))) return false;
      return true;
    });
    if (candidates.length < 3) throw new Error(`Solo ${candidates.length} foto(s) cumplen los filtros`);
  }

  const MAX_CANDIDATES = 150;
  const sampled = candidates.length <= MAX_CANDIDATES ? candidates : smartSample(candidates, MAX_CANDIDATES);
  const actualCount = Math.min(count, sampled.length);
  const filters = { tone, styles, tags: filterTags };

  const { title, statement, selectedIds } = await generateProject(sampled, actualCount, filters);
  if (selectedIds.length === 0) throw new Error('AI could not select photos');

  const scopeLabel = scopeType === 'year' ? scopeValue
    : scopeType === 'event' ? scopeValue?.split('|').slice(1).join('|')
    : scopeType === 'theme' ? scopeValue
    : null;

  const projectId = createProject({ title, statement, scope_type: scopeType, scope_value: scopeLabel ?? null });
  setProjectPhotos(projectId, selectedIds);

  const result = JSON.stringify({ id: projectId, title, statement, photoCount: selectedIds.length });
  updateJob(job.id, { status: 'completed', processed: 1, result } as Parameters<typeof updateJob>[1]);
}

function smartSample<T extends { event: string; tags: string[] }>(all: T[], max: number): T[] {
  const byEvent = new Map<string, T[]>();
  for (const c of all) {
    if (!byEvent.has(c.event)) byEvent.set(c.event, []);
    byEvent.get(c.event)!.push(c);
  }
  const events = Array.from(byEvent.entries());
  const result: T[] = [];
  let remaining = max;
  events.forEach(([, photos], i) => {
    const share = Math.max(1, Math.round((photos.length / all.length) * max));
    const quota = i === events.length - 1 ? remaining : Math.min(share, remaining);
    const sorted = [...photos].sort(() => Math.random() - 0.5).sort((a, b) => b.tags.length - a.tags.length);
    result.push(...sorted.slice(0, quota));
    remaining -= Math.min(quota, sorted.length);
  });
  return result.slice(0, max);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
