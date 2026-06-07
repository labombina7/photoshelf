'use client';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import { IconMenu } from '@/components/Icons';
import { useHeaderSlot } from '@/components/HeaderSlot';
import BootstrapProgressBar from './components/BootstrapProgress';
import YearView from './components/YearView';
import EvolutionLine from './components/EvolutionLine';
import type { BootstrapProgress, Theme } from '@/lib/types';
import type { CatalogRow } from '@/lib/queries/catalogs';
import type { YearData } from '@/app/api/insights/years/route';

interface InsightsClientProps {
  bootstrapProgress: BootstrapProgress;
  years: YearData[];
  themes: Theme[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs: CatalogRow[];
  activeCatalogId: number;
}

export default function InsightsClient({
  bootstrapProgress: initialProgress,
  years: initialYears,
  themes,
  totalPhotos,
  favoriteCount,
  untaggedCount,
  catalogs,
  activeCatalogId,
}: InsightsClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [progress, setProgress] = useState(initialProgress);
  const [years, setYears] = useState(initialYears);
  const [currentIndex, setCurrentIndex] = useState(0); // 0 = most recent

  useHeaderSlot(useMemo(() => (
    <div className="header-slot-library">
      <button className="hamburger header-slot-hamburger" onClick={() => setMobileOpen(true)} title="Menú">
        <IconMenu size={20} />
      </button>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), []));

  // Poll while bootstrap is running
  useEffect(() => {
    if (progress.percent >= 100) return;
    const interval = setInterval(async () => {
      try {
        const [progressRes, yearsRes] = await Promise.all([
          fetch('/api/insights'),
          fetch('/api/insights/years'),
        ]);
        if (progressRes.ok) {
          const data = await progressRes.json() as { bootstrapProgress: BootstrapProgress };
          setProgress(data.bootstrapProgress);
        }
        if (yearsRes.ok) {
          const data = await yearsRes.json() as YearData[];
          setYears(data);
        }
      } catch { /* ignore */ }
    }, 15_000);
    return () => clearInterval(interval);
  }, [progress.percent]);

  const currentYear = years[currentIndex];
  const canPrev = currentIndex < years.length - 1; // older
  const canNext = currentIndex > 0;                 // newer

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes}
        totalPhotos={totalPhotos}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        catalogs={catalogs}
        activeCatalogId={activeCatalogId}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <main className="main-content">
        <div className="insights-page">
          <div className="insights-header">
            <h1 className="insights-title">Tu estilo fotográfico</h1>
            <p className="insights-subtitle">Un análisis de tu catálogo para entenderte mejor como fotógrafo.</p>
          </div>

          <BootstrapProgressBar progress={progress} />

          {years.length === 0 ? (
            <p className="insights-placeholder">Aún no hay datos suficientes para mostrar tu perfil fotográfico.</p>
          ) : (
            <>
              {/* Year navigator */}
              <div className="insights-navigator">
                <button
                  className="insights-nav-arrow"
                  onClick={() => setCurrentIndex(i => i + 1)}
                  disabled={!canPrev}
                  aria-label="Año anterior"
                >
                  ←
                </button>

                <div className="insights-navigator-content">
                  {currentYear && <YearView key={currentYear.year} data={currentYear} />}
                </div>

                <button
                  className="insights-nav-arrow"
                  onClick={() => setCurrentIndex(i => i - 1)}
                  disabled={!canNext}
                  aria-label="Año siguiente"
                >
                  →
                </button>
              </div>

              {/* Evolution line */}
              <EvolutionLine
                years={years}
                currentIndex={currentIndex}
                onSelect={setCurrentIndex}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
