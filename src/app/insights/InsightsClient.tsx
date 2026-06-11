'use client';

import { useState, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import { IconMenu } from '@/components/Icons';
import { useHeaderSlotLeft, useHeaderSlot } from '@/components/HeaderSlot';
import LineChart, { COLORS } from './components/LineChart';
import type { Theme } from '@/lib/types';
import type { CatalogRow } from '@/lib/queries/catalogs';
import type { EvolutionData, SavedAnalysis } from '@/lib/queries/evolution';

interface InsightsClientProps {
  evolutionData: EvolutionData;
  savedAnalysis: SavedAnalysis | null;
  themes: Theme[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs: CatalogRow[];
  activeCatalogId: number;
}

function formatHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h % 1) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export default function InsightsClient({
  evolutionData,
  savedAnalysis: initialAnalysis,
  themes,
  totalPhotos,
  favoriteCount,
  untaggedCount,
  catalogs,
  activeCatalogId,
}: InsightsClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [analysis, setAnalysis] = useState<SavedAnalysis | null>(initialAnalysis);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useHeaderSlotLeft(
    <button className="icon-btn" onClick={() => setSidebarOpen(true)} aria-label="Menú">
      <IconMenu />
    </button>
  );
  useHeaderSlot(null);

  const { years, focals, tags, cameras, hours } = evolutionData;

  // ── Build chart series ────────────────────────────────────────────────────

  const focalSeries = useMemo(() => {
    const focalCount = new Map<number, number>();
    for (const f of focals) focalCount.set(f.focal_length, (focalCount.get(f.focal_length) ?? 0) + f.count);
    const topFocals = [...focalCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f]) => f);

    return topFocals.map((focal, i) => ({
      label: `${focal}mm`,
      color: COLORS[i % COLORS.length],
      data: years
        .map(y => {
          const row = focals.find(f => f.year === y && f.focal_length === focal);
          return row ? { x: y, y: row.count } : null;
        })
        .filter(Boolean) as { x: number; y: number }[],
    })).filter(s => s.data.length > 0);
  }, [focals, years]);

  const tagSeries = useMemo(() => {
    const tagCount = new Map<string, number>();
    for (const t of tags) tagCount.set(t.tag, (tagCount.get(t.tag) ?? 0) + t.count);
    const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);

    return topTags.map((tag, i) => ({
      label: tag,
      color: COLORS[i % COLORS.length],
      data: years
        .map(y => {
          const row = tags.find(t => t.year === y && t.tag === tag);
          return row ? { x: y, y: row.percent } : null;
        })
        .filter(Boolean) as { x: number; y: number }[],
    })).filter(s => s.data.length > 0);
  }, [tags, years]);

  const cameraSeries = useMemo(() => {
    const cameraCount = new Map<string, number>();
    for (const c of cameras) cameraCount.set(c.camera, (cameraCount.get(c.camera) ?? 0) + c.count);
    const topCameras = [...cameraCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);

    return topCameras.map((cam, i) => ({
      label: cam,
      color: COLORS[i % COLORS.length],
      data: years
        .map(y => {
          const row = cameras.find(c => c.year === y && c.camera === cam);
          return row ? { x: y, y: row.percent } : null;
        })
        .filter(Boolean) as { x: number; y: number }[],
    })).filter(s => s.data.length > 0);
  }, [cameras, years]);

  const hourSeries = useMemo(() => [{
    label: 'Hora media',
    color: COLORS[0],
    data: hours.map(h => ({ x: h.year, y: h.avg_hour })),
  }], [hours]);

  // ── Analyze ───────────────────────────────────────────────────────────────

  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch('/api/insights/evolution/analyze', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.error ?? 'Error desconocido');
      } else {
        setAnalysis({ analysis: data.analysis, generated_at: data.generated_at, data_hash: '' });
      }
    } catch {
      setAnalyzeError('Error de red. Inténtalo de nuevo.');
    } finally {
      setAnalyzing(false);
    }
  }

  const canAnalyze = years.length >= 3;
  const hasData = years.length > 0;

  return (
    <div className="app-shell">
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
        themes={themes}
        totalPhotos={totalPhotos}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        catalogs={catalogs}
        activeCatalogId={activeCatalogId}
      />

      <div className="main">
        <div className="content">
          <div className="evolution-header">
            <div className="evolution-header-top">
              <div>
                <h1 className="evolution-title">Evolución fotográfica</h1>
                {hasData && (
                  <p className="evolution-subtitle">
                    {years[0]}–{years[years.length - 1]} · {years.length} años · cámaras móviles excluidas
                  </p>
                )}
              </div>
              {hasData && canAnalyze && (
                <button
                  className="evolution-analyze-btn"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <><span className="evolution-spinner-sm" /> Analizando…</>
                  ) : (
                    analysis ? '↺ Regenerar análisis' : '✦ Analizar evolución'
                  )}
                </button>
              )}
            </div>

            {analyzeError && (
              <div className="evolution-analysis-error">{analyzeError}</div>
            )}

            {analyzing && (
              <div className="evolution-analysis-loading">
                <span className="evolution-spinner" />
                Ollama está analizando tus {years.length} años de fotografía…
              </div>
            )}

            {analysis && !analyzing && (
              <div className="evolution-analysis-result">
                {analysis.analysis.split('\n').filter(Boolean).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                <span className="evolution-analysis-date">
                  Generado el {new Date(analysis.generated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          {!hasData ? (
            <div className="evolution-empty">
              <p>No hay suficientes datos para mostrar tu evolución.</p>
              <p>Necesitas fotos con datos EXIF en al menos un año.</p>
            </div>
          ) : (
            <div className="evolution-charts-grid">
              <LineChart
                title="Focales más usadas (nº fotos)"
                series={focalSeries}
                years={years}
              />
              <LineChart
                title="Tags más frecuentes (% del año)"
                series={tagSeries}
                years={years}
                formatY={v => `${Math.round(v)}%`}
              />
              <LineChart
                title="Cámaras más usadas (% del año)"
                series={cameraSeries}
                years={years}
                formatY={v => `${Math.round(v)}%`}
              />
              <LineChart
                title="Hora media de disparo"
                series={hourSeries}
                years={years}
                formatY={formatHour}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
