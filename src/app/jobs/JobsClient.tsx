'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface JobRow {
  id: string;
  type: string;
  payload: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  started_at: string | null;
  processed: number;
  total: number;
  error_count: number;
  error_last: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending:     'En cola',
  in_progress: 'En progreso',
  completed:   'Completado',
  failed:      'Error',
  cancelled:   'Cancelado',
};

const STATUS_COLOR: Record<string, string> = {
  pending:     '#ca8a04',
  in_progress: '#3b82f6',
  completed:   '#16a34a',
  failed:      '#dc2626',
  cancelled:   'var(--text-tertiary)',
};

function formatPayload(payload: string): { label: string; originUrl: string | null } {
  try {
    const p = JSON.parse(payload) as { type: string; year?: number; event?: string; force?: boolean; originUrl?: string };
    const parts: string[] = [];
    if (p.type === 'classify_year') parts.push(`Clasificar año ${p.year}`);
    else if (p.type === 'classify_batch') parts.push(`Clasificar evento${p.event ? ` "${p.event}"` : ''}`);
    else parts.push(p.type);
    if (p.force) parts.push('· reclasificación');
    return { label: parts.join(' '), originUrl: p.originUrl ?? null };
  } catch {
    return { label: payload, originUrl: null };
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
}

export default function JobsClient() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());

  async function fetchJobs() {
    try {
      const res = await fetch('/api/jobs');
      if (!res.ok) return;
      const data = await res.json() as { jobs: JobRow[] };
      setJobs(data.jobs);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  async function handleCancel(id: string) {
    setCancelling(s => new Set(s).add(id));
    try {
      await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
      await fetchJobs();
    } finally {
      setCancelling(s => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  const active = jobs.filter(j => j.status === 'pending' || j.status === 'in_progress');
  const finished = jobs.filter(j => j.status !== 'pending' && j.status !== 'in_progress');

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>Cola de trabajos</h1>

      {jobs.length === 0 && (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>No hay trabajos recientes.</p>
      )}

      {active.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
            Activos
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {active.map(job => <JobCard key={job.id} job={job} onCancel={handleCancel} cancelling={cancelling.has(job.id)} />)}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
            Recientes
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {finished.map(job => <JobCard key={job.id} job={job} onCancel={handleCancel} cancelling={cancelling.has(job.id)} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function JobCard({ job, onCancel, cancelling }: { job: JobRow; onCancel: (id: string) => void; cancelling: boolean }) {
  const { label, originUrl } = formatPayload(job.payload);
  const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;
  const isActive = job.status === 'pending' || job.status === 'in_progress';

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '14px 16px',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
            background: STATUS_COLOR[job.status] + '22',
            color: STATUS_COLOR[job.status],
            flexShrink: 0,
          }}>
            {STATUS_LABEL[job.status] ?? job.status}
          </span>
          <span style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {originUrl && (
            <Link href={originUrl} style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Ver origen →
            </Link>
          )}
          {isActive && (
            <button
              onClick={() => onCancel(job.id)}
              disabled={cancelling}
              style={{
                fontSize: 12, padding: '3px 10px', borderRadius: 4,
                border: '1px solid var(--border)', background: 'none',
                cursor: cancelling ? 'not-allowed' : 'pointer',
                color: 'var(--text-secondary)',
                opacity: cancelling ? 0.5 : 1,
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {isActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
            {job.status === 'in_progress' && job.processed > 0 ? (
              <div style={{ height: '100%', width: `${pct}%`, background: '#3b82f6', borderRadius: 2, transition: 'width 0.4s ease' }} />
            ) : (
              <div style={{ height: '100%', width: '30%', background: '#3b82f6', borderRadius: 2, animation: 'pulse 1.5s ease-in-out infinite' }} />
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
            {job.processed > 0 ? `${job.processed}/${job.total}` : job.status === 'pending' ? 'Esperando…' : '…'}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
        <span>Iniciado {formatDate(job.created_at)}</span>
        {job.processed > 0 && job.status === 'completed' && (
          <span>{job.processed} fotos procesadas</span>
        )}
        {job.error_count > 0 && (
          <span style={{ color: '#dc2626' }}>{job.error_count} errores</span>
        )}
      </div>

      {job.error_last && job.status === 'failed' && (
        <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{job.error_last}</p>
      )}
    </div>
  );
}
