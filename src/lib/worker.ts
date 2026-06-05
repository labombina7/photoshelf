import { getDb } from './db';
import { classifyPhoto } from './ollama';
import { upsertAiTags } from './db-helpers';
import { CLASSIFY_BATCH_SIZE } from './config';
import { getNextJob, updateJob, purgeOldJobs, type JobRow } from './queries/jobs';

interface JobPayload {
  type: 'classify_year' | 'classify_batch';
  year?: number;
  event?: string;
  force: boolean;
  catalogId: number;
  photosRoot: string;
  originUrl: string;
}

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
  const db = getDb();
  const startedAt = new Date().toISOString();
  updateJob(job.id, { status: 'in_progress', started_at: startedAt });

  try {
    const payload = JSON.parse(job.payload) as JobPayload;
    const { force, catalogId, photosRoot } = payload;

    const params: (string | number)[] = [catalogId];
    let sql = `SELECT p.id, p.path, p.event FROM photos p WHERE p.catalog_id = ?`;

    if (payload.year !== undefined) {
      sql += ' AND p.year = ?';
      params.push(payload.year);
    }
    if (payload.event) {
      sql += ' AND p.event = ?';
      params.push(payload.event);
    }

    if (!force) {
      sql += ` AND NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id AND pt.source = 'ai')`;
    } else {
      // Skip photos already processed in this run (tags created after startedAt)
      sql += ` AND NOT EXISTS (
        SELECT 1 FROM photo_tags pt
        WHERE pt.photo_id = p.id AND pt.source = 'ai' AND pt.created_at >= ?
      )`;
      params.push(startedAt);
    }

    sql += ' ORDER BY p.year ASC, p.event ASC, p.filename ASC';

    const photos = db.prepare(sql).all(...params) as { id: number; path: string; event: string }[];

    // Total = already processed + still pending (accurate after resumption)
    const total = job.processed + photos.length;
    updateJob(job.id, { total });

    const deleteAiTags = db.prepare(`DELETE FROM photo_tags WHERE photo_id = ? AND source = 'ai'`);
    let processed = job.processed;
    let errorCount = job.error_count;

    for (let i = 0; i < photos.length; i += CLASSIFY_BATCH_SIZE) {
      // Check for cancellation before each batch
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
          console.error(`[worker] Error in job ${job.id}:`, msg);
          updateJob(job.id, { error_last: msg });
        }
      }

      updateJob(job.id, { processed, error_count: errorCount });
    }

    updateJob(job.id, { status: 'completed' });
    purgeOldJobs();

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[worker] Unexpected error in job ${job.id}:`, msg);
    updateJob(job.id, { status: 'failed', error_last: msg });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
