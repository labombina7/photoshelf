'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSparkle, IconX, IconSearch } from './Icons';

interface SearchPhoto {
  id: number;
  filename: string;
  year: number;
  event: string;
}

interface SearchResult {
  photos: SearchPhoto[];
  concept: string;
  year: number | null;
  mode: 'quick' | 'deep';
  total?: number;
  analyzed?: number;
  next_offset?: number;
  total_candidates?: number;
  has_more?: boolean;
}

export default function AISearchPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'quick' | 'deep'>('quick');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [themeName, setThemeName] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  async function handleSearch(offset = 0) {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    if (offset === 0) setResult(null);

    try {
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode, offset }),
      });
      const data: SearchResult = await res.json();

      if (offset > 0 && result) {
        setResult({
          ...data,
          photos: [...result.photos, ...data.photos],
        });
      } else {
        setResult(data);
        setThemeName(data.concept ?? '');
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveTheme() {
    if (!result || result.photos.length === 0 || !themeName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: themeName.trim(), color: '#3b62d4' }),
      });
      const theme = await res.json();

      await Promise.all(result.photos.map(p =>
        fetch(`/api/photo-themes/${p.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ themeId: theme.id }),
        })
      ));

      setSavedMsg(`Temática "${themeName}" guardada con ${result.photos.length} fotos`);
      setTimeout(() => setSavedMsg(''), 4000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const analyzed = result?.analyzed ?? 0;
  const totalCandidates = result?.total_candidates ?? 0;
  const progressPct = totalCandidates > 0
    ? Math.round(((result?.next_offset ?? 0) / totalCandidates) * 100)
    : 0;

  return (
    <>
      <button
        className="ai-search-trigger"
        onClick={() => setOpen(true)}
        title="Búsqueda inteligente"
      >
        <IconSparkle size={14} />
        Buscar
      </button>

      {open && (
        <div className="ai-panel-overlay" onClick={() => setOpen(false)} />
      )}

      <div className={`ai-panel ${open ? 'open' : ''}`}>
        <div className="ai-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconSparkle size={14} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Búsqueda inteligente</span>
          </div>
          <button className="ai-panel-close" onClick={() => setOpen(false)}>
            <IconX size={14} />
          </button>
        </div>

        <div className="ai-panel-body">
          <textarea
            className="ai-search-input"
            placeholder="Ej: fotos de naturaleza del año 2025, retratos en blanco y negro, bodas al aire libre…"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSearch(0); }}
            rows={3}
          />

          <div className="ai-mode-toggle">
            <button
              className={`ai-mode-btn ${mode === 'quick' ? 'active' : ''}`}
              onClick={() => setMode('quick')}
            >
              <IconSearch size={11} />
              Rápida
            </button>
            <button
              className={`ai-mode-btn ${mode === 'deep' ? 'active' : ''}`}
              onClick={() => setMode('deep')}
            >
              <IconSparkle size={11} />
              Profunda
            </button>
          </div>

          {mode === 'deep' && (
            <p className="ai-mode-hint">
              Analiza las fotos con visión IA y las etiqueta. Procesa 50 fotos por búsqueda.
            </p>
          )}

          <button
            className="btn-primary ai-search-btn"
            onClick={() => handleSearch(0)}
            disabled={loading || !prompt.trim()}
          >
            {loading ? 'Buscando…' : 'Buscar'}
          </button>

          {result && (
            <div className="ai-results">
              <div className="ai-results-meta">
                <span>{result.photos.length} fotos encontradas</span>
                {result.mode === 'deep' && totalCandidates > 0 && (
                  <span className="ai-progress">
                    {Math.min(result.next_offset ?? 0, totalCandidates)}/{totalCandidates} analizadas ({progressPct}%)
                  </span>
                )}
              </div>

              {result.mode === 'deep' && totalCandidates > 0 && (
                <div className="ai-progress-bar">
                  <div className="ai-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              )}

              <div className="ai-photo-grid">
                {result.photos.map(photo => (
                  <a
                    key={photo.id}
                    href={`/library/${photo.id}`}
                    className="ai-photo-thumb"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/photos/${photo.id}/thumbnail?size=150`}
                      alt={photo.filename}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </a>
                ))}
              </div>

              {result.mode === 'deep' && result.has_more && (
                <button
                  className="collapse-btn"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                  onClick={() => handleSearch(result.next_offset ?? 0)}
                  disabled={loading}
                >
                  {loading ? 'Analizando…' : `Analizar 50 más (quedan ${totalCandidates - (result.next_offset ?? 0)})`}
                </button>
              )}

              {result.photos.length > 0 && (
                <div className="ai-save-theme">
                  <input
                    className="tag-input"
                    placeholder="Nombre de la temática"
                    value={themeName}
                    onChange={e => setThemeName(e.target.value)}
                  />
                  <button
                    className="btn-primary"
                    style={{ fontSize: 12, padding: '6px 12px' }}
                    onClick={saveTheme}
                    disabled={saving || !themeName.trim()}
                  >
                    {saving ? 'Guardando…' : 'Guardar como temática'}
                  </button>
                  {savedMsg && <p style={{ fontSize: 12, color: 'var(--tag-auto-color)', marginTop: 4 }}>{savedMsg}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
