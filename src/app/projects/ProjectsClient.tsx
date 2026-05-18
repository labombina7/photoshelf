'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { IconSparkle, IconTrash, IconPlus, IconX } from '@/components/Icons';
import type { Theme } from '@/lib/types';

interface Project {
  id: number;
  title: string;
  statement: string;
  scope_type: string;
  scope_value: string | null;
  created_at: string;
  photo_count: number;
  cover_photo_id: number | null;
}

interface ScopeOption {
  label: string;
  scopeType: 'year' | 'event' | 'theme' | 'all';
  scopeValue?: string;
}

interface Props {
  projects: Project[];
  sidebarProjects: { id: number; title: string }[];
  themes: Theme[];
  years: number[];
  events: { year: number; event: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
}

export default function ProjectsClient({ projects: initial, sidebarProjects, themes, years, events, totalPhotos, favoriteCount, untaggedCount }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [projects, setProjects] = useState(initial);
  const [showNew, setShowNew] = useState(false);
  const [scanning, setScanning] = useState(false);

  const scopes: ScopeOption[] = [
    { label: 'Todas las fotos', scopeType: 'all' },
    ...years.map(y => ({ label: `Año ${y}`, scopeType: 'year' as const, scopeValue: String(y) })),
    ...events.map(e => ({ label: `${e.event} (${e.year})`, scopeType: 'event' as const, scopeValue: `${e.year}|${e.event}` })),
    ...themes.map(t => ({ label: `Temática: ${t.name}`, scopeType: 'theme' as const, scopeValue: String(t.id) })),
  ];

  const [selectedScopeIdx, setSelectedScopeIdx] = useState(0);
  const [count, setCount] = useState(15);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  async function handleScan() {
    setScanning(true);
    try {
      await fetch('/api/scan', { method: 'POST' });
      startTransition(() => router.refresh());
    } finally {
      setScanning(false);
    }
  }

  async function generate() {
    const scope = scopes[selectedScopeIdx];
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/projects/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopeType: scope.scopeType, scopeValue: scope.scopeValue, count }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error generando proyecto'); return; }
      setShowNew(false);
      router.push(`/projects/${data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('timeout') || msg.includes('AbortError')) {
        setError('Timeout: Ollama tardó demasiado. Prueba con un scope más pequeño o menos fotos.');
      } else {
        setError('Error de conexión. Comprueba que Ollama está activo en el Mac.');
      }
    } finally {
      setGenerating(false);
    }
  }

  async function deleteProject(id: number) {
    if (!confirm('¿Eliminar este proyecto?')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    setProjects(prev => prev.filter(p => p.id !== id));
  }

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes}
        projects={sidebarProjects}
        totalPhotos={totalPhotos}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        onScan={handleScan}
        scanning={scanning}
      />

      <div className="main">
        <div className="topbar">
          <div className="topbar-title">Proyectos</div>
          <span className="topbar-sub">{projects.length} proyecto{projects.length !== 1 ? 's' : ''}</span>
          <div className="topbar-spacer" />
          <button
            className="btn-primary"
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', fontSize: 13 }}
            onClick={() => setShowNew(true)}
          >
            <IconPlus size={13} />
            Nuevo proyecto
          </button>
        </div>

        <div className="content">
          {projects.length === 0 ? (
            <div className="empty-state">
              <IconSparkle size={32} />
              <p>Aún no hay proyectos.</p>
              <p style={{ fontSize: 12 }}>Pulsa "Nuevo proyecto" para generar uno con IA.</p>
            </div>
          ) : (
            <div className="projects-grid">
              {projects.map(p => (
                <div key={p.id} className="project-card">
                  <Link href={`/projects/${p.id}`} className="project-card-cover">
                    {p.cover_photo_id ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/photos/${p.cover_photo_id}/thumbnail?size=600`} alt={p.title} />
                    ) : (
                      <div className="project-card-cover-empty"><IconSparkle size={24} /></div>
                    )}
                  </Link>
                  <div className="project-card-info">
                    <Link href={`/projects/${p.id}`} className="project-card-title">{p.title}</Link>
                    <p className="project-card-meta">
                      {p.photo_count} fotos · {new Date(p.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {p.statement && <p className="project-card-statement">{p.statement}</p>}
                  </div>
                  <button className="project-delete-btn" onClick={() => deleteProject(p.id)} title="Eliminar">
                    <IconTrash size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New project modal */}
      {showNew && (
        <>
          <div className="review-overlay" onClick={() => !generating && setShowNew(false)} />
          <div className="new-project-modal">
            <div className="review-modal-header">
              <span style={{ fontWeight: 600, fontSize: 14 }}>Nuevo proyecto fotográfico</span>
              <button className="ai-panel-close" onClick={() => !generating && setShowNew(false)}>
                <IconX size={14} />
              </button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Origen de las fotos</label>
                <select
                  className="scope-select"
                  value={selectedScopeIdx}
                  onChange={e => setSelectedScopeIdx(parseInt(e.target.value, 10))}
                  disabled={generating}
                >
                  {scopes.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Número de fotos — {count}</label>
                <input
                  type="range" min={5} max={30} value={count}
                  onChange={e => setCount(parseInt(e.target.value, 10))}
                  style={{ width: '100%' }}
                  disabled={generating}
                />
              </div>
              {error && <p style={{ fontSize: 13, color: '#c0392b' }}>{error}</p>}
              <button
                className="btn-primary"
                onClick={generate}
                disabled={generating}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {generating
                  ? <><span className="spinner" />Generando…</>
                  : <><IconSparkle size={14} />Generar con IA</>}
              </button>
              {generating && (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  Ollama está seleccionando las fotos y redactando el statement. Puede tardar 30-60 segundos.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
