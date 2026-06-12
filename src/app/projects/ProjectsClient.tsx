'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useJobPolling } from '@/hooks/useJobPolling';
import { useRouter } from 'next/navigation';
import { useModal } from '@/components/ModalProvider';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { IconSparkle, IconTrash, IconPlus, IconX, IconMenu } from '@/components/Icons';
import { useHeaderSlotLeft } from '@/components/HeaderSlot';
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

const STYLES = ['portrait', 'landscape', 'street', 'fashion', 'editorial', 'architecture', 'documentary', 'wildlife', 'travel', 'sport', 'abstract', 'macro', 'product'];

interface Props {
  projects: Project[];
  themes: Theme[];
  years: number[];
  events: { year: number; event: string }[];
  topTags: string[];
  allTags: string[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
}

export default function ProjectsClient({ projects: initial, themes, years, events, topTags, allTags, totalPhotos, favoriteCount, untaggedCount }: Props) {
  const router = useRouter();
  const { confirm } = useModal();
  const [projects, setProjects] = useState(initial);
  const [showNew, setShowNew] = useState(false);

  const scopes: ScopeOption[] = [
    { label: 'Todas las fotos', scopeType: 'all' },
    ...years.map(y => ({ label: `Año ${y}`, scopeType: 'year' as const, scopeValue: String(y) })),
    ...events.map(e => ({ label: `${e.event} (${e.year})`, scopeType: 'event' as const, scopeValue: `${e.year}|${e.event}` })),
    ...themes.map(t => ({ label: `Temática: ${t.name}`, scopeType: 'theme' as const, scopeValue: String(t.id) })),
  ];

  const [selectedScopeIdx, setSelectedScopeIdx] = useState(0);
  const [count, setCount] = useState(15);
  const [generating, setGenerating] = useState(false);
  const [generatingJobId, setGeneratingJobId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const generateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useJobPolling(generatingJobId, {
    onComplete: (job) => {
      if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);
      if (!job.result) return;
      setGenerating(false);
      setShowNew(false);
      setGeneratingJobId(null);
      const result = JSON.parse(job.result) as { id: number };
      router.push(`/projects/${result.id}`);
    },
    onFail: (job) => {
      if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);
      setGenerating(false);
      setGeneratingJobId(null);
      setError(job.error_last ?? 'Error generando proyecto');
    },
  });

  async function cancelGeneration() {
    if (!generatingJobId) return;
    if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);
    await fetch(`/api/jobs/${generatingJobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    setGenerating(false);
    setGeneratingJobId(null);
    setError('Generación cancelada.');
  }

  useEffect(() => {
    return () => { if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current); };
  }, []);

  // Filters
  const [tone, setTone] = useState<'all' | 'b&w' | 'color'>('all');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  const tagSuggestions = tagInput.length > 0
    ? allTags.filter(t => t.includes(tagInput.toLowerCase()) && !selectedTags.includes(t)).slice(0, 6)
    : [];

  function toggleStyle(s: string) {
    setSelectedStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    setError('');
  }
  function toggleTag(t: string) {
    setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
    setError('');
  }
  function addTagFromInput(t: string) {
    if (!selectedTags.includes(t)) setSelectedTags(prev => [...prev, t]);
    setTagInput('');
    setShowTagSuggestions(false);
    setError('');
  }

  async function generate() {
    const scope = scopes[selectedScopeIdx];
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/projects/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopeType: scope.scopeType,
          scopeValue: scope.scopeValue,
          count,
          tone: tone === 'all' ? undefined : tone,
          styles: selectedStyles.length > 0 ? selectedStyles : undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
        }),
      });
      const data = await res.json() as { jobId?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Error generando proyecto'); setGenerating(false); return; }
      if (!data.jobId) { setError('Respuesta inesperada del servidor'); setGenerating(false); return; }

      setGeneratingJobId(data.jobId);
      generateTimeoutRef.current = setTimeout(() => {
        setGenerating(false);
        setGeneratingJobId(null);
        setError('La generación está tardando demasiado. Puedes revisar el estado en Cola de trabajos.');
      }, 3 * 60 * 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg || 'Error de conexión. Comprueba que Ollama está activo en el Mac.');
      setGenerating(false);
    }
  }

  async function deleteProject(id: number) {
    const ok = await confirm('¿Eliminar este proyecto?', { title: 'Eliminar proyecto', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    setProjects(prev => prev.filter(p => p.id !== id));
  }

  useEffect(() => {
    function onNew() { setShowNew(true); }
    window.addEventListener('photoshelf:new-project', onNew);
    return () => window.removeEventListener('photoshelf:new-project', onNew);
  }, []);

  useHeaderSlotLeft(useMemo(() => (
    <div className="header-slot-library">
      <button className="hamburger header-slot-hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
        <IconMenu size={20} />
      </button>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), []));

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <div className="main">
        <div className="content">
          {projects.length === 0 ? (
            <div className="empty-state">
              <IconSparkle size={32} />
              <p className="empty-state-title">Aún no hay proyectos</p>
              <p className="empty-state-subtitle">Genera tu primer portfolio con IA a partir de cualquier conjunto de fotos.</p>
              <button className="btn-small" onClick={() => setShowNew(true)}>
                Crear primer proyecto
              </button>
            </div>
          ) : (
            <div className="projects-grid">
              {projects.map(p => (
                <div key={p.id} className="project-card">
                  <Link href={`/projects/${p.id}`} className="project-card-cover">
                    {p.cover_photo_id ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/photos/${p.cover_photo_id}/thumbnail?size=600`} alt={p.title} loading="lazy" decoding="async" />
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
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Scope */}
              <div>
                <label className="field-label">Origen de las fotos</label>
                <select
                  className="scope-select"
                  value={selectedScopeIdx}
                  onChange={e => { setSelectedScopeIdx(parseInt(e.target.value, 10)); setError(''); }}
                  disabled={generating}
                >
                  {scopes.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                </select>
              </div>

              {/* Count */}
              <div>
                <label className="field-label">Número de fotos — {count}</label>
                <input
                  type="range" min={5} max={30} value={count}
                  onChange={e => setCount(parseInt(e.target.value, 10))}
                  style={{ width: '100%' }}
                  disabled={generating}
                  aria-label="Número de fotos"
                  aria-valuetext={`${count} fotos`}
                />
              </div>

              {/* Tone */}
              <div>
                <label className="field-label">Tono</label>
                <div className="tone-toggle">
                  {(['all', 'color', 'b&w'] as const).map(t => (
                    <button
                      key={t}
                      className={`tone-btn${tone === t ? ' tone-btn--active' : ''}`}
                      onClick={() => { setTone(t); setError(''); }}
                      disabled={generating}
                    >
                      {t === 'all' ? 'Todas' : t === 'color' ? 'Color' : 'B&W'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Styles */}
              <div>
                <label className="field-label">Estilo fotográfico</label>
                <div className="filter-chips">
                  {STYLES.map(s => (
                    <button
                      key={s}
                      className={`filter-chip${selectedStyles.includes(s) ? ' filter-chip--active' : ''}`}
                      onClick={() => toggleStyle(s)}
                      disabled={generating}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="field-label">Tags</label>
                <div className="filter-chips" style={{ marginBottom: 8 }}>
                  {topTags.map(t => (
                    <button
                      key={t}
                      className={`filter-chip${selectedTags.includes(t) ? ' filter-chip--active' : ''}`}
                      onClick={() => toggleTag(t)}
                      disabled={generating}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    className="tag-search-input"
                    placeholder="Buscar más tags…"
                    value={tagInput}
                    onChange={e => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
                    disabled={generating}
                  />
                  {showTagSuggestions && tagSuggestions.length > 0 && (
                    <div className="tag-suggestions">
                      {tagSuggestions.map(t => (
                        <button key={t} className="tag-suggestion-item" onMouseDown={() => addTagFromInput(t)}>{t}</button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedTags.length > 0 && (
                  <div className="filter-chips" style={{ marginTop: 8 }}>
                    {selectedTags.map(t => (
                      <button key={t} className="filter-chip filter-chip--active" onClick={() => toggleTag(t)} disabled={generating}>
                        {t} ×
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && <p style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
              <button
                className="btn-primary"
                onClick={generate}
                disabled={generating}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {generating
                  ? <><span className="spinner" />Generando…</>
                  : <><IconSparkle size={14} />Generar</>}
              </button>
              {generating && generatingJobId && (
                <button
                  className="btn-ghost"
                  onClick={cancelGeneration}
                  style={{ fontSize: 12, marginTop: 4 }}
                >
                  Cancelar
                </button>
              )}
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
