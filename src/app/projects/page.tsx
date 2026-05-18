'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconSparkle, IconTrash, IconPlus } from '@/components/Icons';

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

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [scopes, setScopes] = useState<ScopeOption[]>([]);
  const [selectedScope, setSelectedScope] = useState<ScopeOption | null>(null);
  const [count, setCount] = useState(15);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(data => {
      setProjects(data);
      setLoading(false);
    });

    // Build scope options from years, events, themes
    Promise.all([
      fetch('/api/photos/groups').then(r => r.json()),
      fetch('/api/themes').then(r => r.json()),
    ]).then(([groups, themes]) => {
      const opts: ScopeOption[] = [{ label: 'Todas las fotos', scopeType: 'all' }];

      const allYears: number[] = (groups.groups ?? []).map((g: { year: number }) => g.year);
      const years = allYears.filter((y, i) => allYears.indexOf(y) === i).sort((a, b) => b - a);
      years.forEach(y => opts.push({ label: `Año ${y}`, scopeType: 'year', scopeValue: String(y) }));

      (groups.groups ?? []).forEach((g: { year: number; event: string }) => {
        opts.push({ label: `${g.event} (${g.year})`, scopeType: 'event', scopeValue: `${g.year}|${g.event}` });
      });

      themes.forEach((t: { id: number; name: string }) => {
        opts.push({ label: `Temática: ${t.name}`, scopeType: 'theme', scopeValue: String(t.id) });
      });

      setScopes(opts);
      setSelectedScope(opts[0]);
    });
  }, []);

  async function generate() {
    if (!selectedScope) return;
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/projects/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopeType: selectedScope.scopeType,
          scopeValue: selectedScope.scopeValue,
          count,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error generando proyecto'); return; }
      setShowNew(false);
      router.push(`/projects/${data.id}`);
    } catch {
      setError('Error de conexión');
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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 48px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Proyectos</h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Proyectos fotográficos generados con IA</p>
          </div>
          <button
            className="btn-primary"
            style={{ marginLeft: 'auto', width: 'auto', display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px' }}
            onClick={() => setShowNew(true)}
          >
            <IconPlus size={14} />
            Nuevo proyecto
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Cargando…</p>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <IconSparkle size={32} />
            <p>Aún no hay proyectos. Crea el primero.</p>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map(p => (
              <div key={p.id} className="project-card">
                <Link href={`/projects/${p.id}`} className="project-card-cover">
                  {p.cover_photo_id ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/photos/${p.cover_photo_id}/thumbnail?size=600&fit=inside`} alt={p.title} />
                  ) : (
                    <div className="project-card-cover-empty"><IconSparkle size={24} /></div>
                  )}
                </Link>
                <div className="project-card-info">
                  <Link href={`/projects/${p.id}`} className="project-card-title">{p.title}</Link>
                  <p className="project-card-meta">{p.photo_count} fotos · {new Date(p.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  {p.statement && <p className="project-card-statement">{p.statement}</p>}
                  <button className="project-delete-btn" onClick={() => deleteProject(p.id)} title="Eliminar"><IconTrash size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New project modal */}
      {showNew && (
        <>
          <div className="review-overlay" onClick={() => !generating && setShowNew(false)} />
          <div className="new-project-modal">
            <div className="review-modal-header">
              <span style={{ fontWeight: 600, fontSize: 14 }}>Nuevo proyecto fotográfico</span>
              <button className="ai-panel-close" onClick={() => setShowNew(false)} disabled={generating}>×</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Origen de las fotos</label>
                <select
                  className="scope-select"
                  value={scopes.indexOf(selectedScope!)}
                  onChange={e => setSelectedScope(scopes[parseInt(e.target.value, 10)])}
                >
                  {scopes.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Número de fotos en el proyecto</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="range" min={5} max={30} value={count}
                    onChange={e => setCount(parseInt(e.target.value, 10))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{count}</span>
                </div>
              </div>
              {error && <p style={{ fontSize: 13, color: '#c0392b' }}>{error}</p>}
              <button className="btn-primary" onClick={generate} disabled={generating} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {generating ? <><span className="spinner" />Generando proyecto…</> : <><IconSparkle size={14} />Generar con IA</>}
              </button>
              {generating && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>Ollama está seleccionando y curating las fotos. Puede tardar 30-60 segundos.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
