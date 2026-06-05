import { getDb } from '@/lib/db';

export interface JobRow {
  id: string;
  type: string;
  payload: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  started_at: string | null;
  processed: number;
  total: number;
  error_count: number;
  error_last: string | null;
  result: string | null;
  created_at: string;
}

export function createJob(id: string, type: string, payload: string, total: number): void {
  getDb().prepare(
    `INSERT INTO job_queue (id, type, payload, status, total) VALUES (?, ?, ?, 'pending', ?)`
  ).run(id, type, payload, total);
}

export function getJob(id: string): JobRow | undefined {
  return getDb().prepare(`SELECT * FROM job_queue WHERE id = ?`).get(id) as JobRow | undefined;
}

export function getNextJob(): JobRow | undefined {
  const db = getDb();
  const inProgress = db.prepare(
    `SELECT * FROM job_queue WHERE status = 'in_progress' ORDER BY created_at ASC LIMIT 1`
  ).get() as JobRow | undefined;
  if (inProgress) return inProgress;

  return db.prepare(
    `SELECT * FROM job_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`
  ).get() as JobRow | undefined;
}

export function getActiveJob(): JobRow | undefined {
  return getDb().prepare(
    `SELECT * FROM job_queue WHERE status IN ('pending', 'in_progress') ORDER BY created_at ASC LIMIT 1`
  ).get() as JobRow | undefined;
}

export function listJobs(limit = 20): JobRow[] {
  return getDb().prepare(
    `SELECT * FROM job_queue ORDER BY created_at DESC LIMIT ?`
  ).all(limit) as JobRow[];
}

export function updateJob(id: string, patch: Partial<Pick<JobRow, 'status' | 'started_at' | 'processed' | 'total' | 'error_count' | 'error_last' | 'result'>>): void {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);
  getDb().prepare(`UPDATE job_queue SET ${setClauses} WHERE id = ?`).run(...values, id);
}

export function cancelJob(id: string): boolean {
  const info = getDb().prepare(
    `UPDATE job_queue SET status = 'cancelled' WHERE id = ? AND status IN ('pending', 'in_progress')`
  ).run(id);
  return info.changes > 0;
}

export function purgeOldJobs(): void {
  getDb().prepare(
    `DELETE FROM job_queue WHERE status IN ('completed', 'failed', 'cancelled') AND created_at < datetime('now', '-48 hours')`
  ).run();
}

export function hasActiveJobForYear(year: number, catalogId: number): boolean {
  const row = getDb().prepare(
    `SELECT 1 FROM job_queue WHERE status IN ('pending','in_progress')
     AND json_extract(payload, '$.year') = ?
     AND json_extract(payload, '$.catalogId') = ?`
  ).get(year, catalogId);
  return !!row;
}
