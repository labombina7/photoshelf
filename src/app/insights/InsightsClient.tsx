'use client';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import { IconMenu } from '@/components/Icons';
import { useHeaderSlotLeft } from '@/components/HeaderSlot';
import BootstrapProgressBar from './components/BootstrapProgress';
import HistoryBlock from './components/HistoryBlock';
import RecentEvolutionBlock from './components/RecentEvolutionBlock';
import type { BootstrapProgress, StyleProfile, Theme } from '@/lib/types';
import type { CatalogRow } from '@/lib/queries/catalogs';

interface InsightsClientProps {
  bootstrapProgress: BootstrapProgress;
  annualProfiles: StyleProfile[];
  monthlyProfiles: StyleProfile[];
  themes: Theme[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs: CatalogRow[];
  activeCatalogId: number;
}

export default function InsightsClient({
  bootstrapProgress: initialProgress,
  annualProfiles: initialAnnual,
  monthlyProfiles: initialMonthly,
  themes,
  totalPhotos,
  favoriteCount,
  untaggedCount,
  catalogs,
  activeCatalogId,
}: InsightsClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [progress, setProgress] = useState(initialProgress);
  const [annualProfiles, setAnnualProfiles] = useState(initialAnnual);
  const [monthlyProfiles, setMonthlyProfiles] = useState(initialMonthly);

  const headerSlotLeft = useMemo(() => (
    <button
      className="btn-icon mobile-only"
      onClick={() => setMobileOpen(true)}
      aria-label="Abrir menú"
    >
      <IconMenu />
    </button>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), []);

  useHeaderSlotLeft(headerSlotLeft);

  // Poll for updates while bootstrap is still running
  useEffect(() => {
    if (progress.percent >= 100) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/insights');
        if (!res.ok) return;
        const data = await res.json() as {
          bootstrapProgress: BootstrapProgress;
          annualProfiles: StyleProfile[];
          monthlyProfiles: StyleProfile[];
        };
        setProgress(data.bootstrapProgress);
        setAnnualProfiles(data.annualProfiles);
        setMonthlyProfiles(data.monthlyProfiles);
      } catch { /* ignore */ }
    }, 15_000);
    return () => clearInterval(interval);
  }, [progress.percent]);

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
            <p className="insights-subtitle">Un análisis continuo de tu catálogo para entenderte mejor como fotógrafo.</p>
          </div>

          <BootstrapProgressBar progress={progress} />

          <div className="insights-blocks">
            <RecentEvolutionBlock profiles={monthlyProfiles} />
            <HistoryBlock profiles={annualProfiles} />
          </div>
        </div>
      </main>
    </div>
  );
}
