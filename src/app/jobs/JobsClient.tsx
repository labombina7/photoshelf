'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { IconMenu } from '@/components/Icons';
import { useHeaderSlot } from '@/components/HeaderSlot';
import type { ThemeWithCount } from '@/lib/queries/themes';
import type { CatalogRow } from '@/lib/queries/catalogs';

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
  result: string | null;
  created_at: string;
}

interface Props {
  themes: ThemeWithCount[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs: CatalogRow[];
  activeCatalogId: number;
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
    const p = JSON.parse(payload) as { type: string; year?: number; event?: string; force?: boolean; originUrl?: string; scopeType?: string; scopeValue?: string };
    const parts: string[] = [];
    if (p.type === 'classify_year')  parts.push(`Clasificar año ${p.year}`);
    else if (p.type === 'classify_batch') parts.push(`Clasificar evento${p.event ? ` "${p.event}"` : ''}`);
    else if (p.type === 'generate_project') parts.push(`Generar proyecto (${p.scopeType}${p.scopeValue ? ` · ${p.scopeValue}` : ''})`);
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

interface AmplitudeStatus {
  configured: boolean;
  total: number;
  synced: number;
  percent: number;
}

function AmplitudeCard() {
  const [status, setStatus] = useState<AmplitudeStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/amplitude/sync');
      if (res.ok) setStatus(await res.json() as AmplitudeStatus);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch('/api/amplitude/sync', { method: 'POST' });
      await fetchStatus();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
        Amplitude
      </h2>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!status ? (
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0 }}>Cargando…</p>
        ) : !status.configured ? (
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 6px' }}>API key no configurada</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Añade <code style={{ fontFamily: 'monospace', background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>AMPLITUDE_API_KEY=…</code> al <code style={{ fontFamily: 'monospace', background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>.env</code> de docker-compose y reinicia el contenedor.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 2px' }}>
                  {status.synced.toLocaleString('es-ES')} de {status.total.toLocaleString('es-ES')} fotos sincronizadas
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>{status.percent}% completado</p>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing || status.synced === status.total}
                style={{
                  fontSize: 13, padding: '6px 14px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'none',
                  cursor: (syncing || status.synced === status.total) ? 'not-allowed' : 'pointer',
                  color: 'var(--text-primary)', flexShrink: 0,
                  opacity: (syncing || status.synced === status.total) ? 0.5 : 1,
                }}
              >
                {syncing ? 'Sincronizando…' : status.synced === status.total ? '✓ Al día' : 'Sincronizar ahora'}
              </button>
            </div>
            {status.total > 0 && status.percent < 100 && (
              <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${status.percent}%`, background: '#6366f1', borderRadius: 2, transition: 'width 0.5s ease' }} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default function JobsClient({ themes, totalPhotos, favoriteCount, untaggedCount, catalogs, activeCatalogId }: Props) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useHeaderSlot(useMemo(() => (
    <div className="header-slot-library">
      <button className="hamburger header-slot-hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
        <IconMenu size={20} />
      </button>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), []));

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

  const active   = jobs.filter(j => j.status === 'pending' || j.status === 'in_progress');
  const finished = jobs.filter(j => j.status !== 'pending' && j.status !== 'in_progress');

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes}
        totalPhotos={totalPhotos}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        catalogs={catalogs}
        activeCatalogId={activeCatalogId}
      />

      <div className="main">
        <div className="content" style={{ maxWidth: 760 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, marginTop: 8 }}>Cola de trabajos</h1>

          <AmplitudeCard />

          {jobs.length === 0 && (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>No hay trabajos recientes.</p>
          )}

          {active.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
                Activos
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {active.map(job => <JobCard key={job.id} job={job} onCancel={handleCancel} cancelling={cancelling.has(job.id)} />)}
              </div>
            </section>
          )}

          {finished.length > 0 && (
            <section>
              <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
                Recientes
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {finished.map(job => <JobCard key={job.id} job={job} onCancel={handleCancel} cancelling={cancelling.has(job.id)} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function JobCard({ job, onCancel, cancelling }: { job: JobRow; onCancel: (id: string) => void; cancelling: boolean }) {
  const { label, originUrl } = formatPayload(job.payload);
  const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;
  const isActive = job.status === 'pending' || job.status === 'in_progress';

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
            background: STATUS_COLOR[job.status] + '22', color: STATUS_COLOR[job.status],
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
                color: 'var(--text-secondary)', opacity: cancelling ? 0.5 : 1,
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
              <div className="classify-inline-pulse" style={{ height: '100%', width: '30%', background: '#3b82f6', borderRadius: 2 }} />
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
            {job.processed > 0 ? `${job.processed}/${job.total}` : job.status === 'pending' ? 'Esperando…' : '…'}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
        <span>Creado {formatDate(job.created_at)}</span>
        {job.status === 'completed' && job.processed > 0 && (
          <span>{job.processed} procesadas</span>
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
