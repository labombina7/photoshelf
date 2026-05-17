'use client';

import { useState, useTransition, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PhotoGrid from '@/components/PhotoGrid';
import FolderGrid from '@/components/FolderGrid';
import { IconSearch, IconSparkle, IconViewList, IconViewGrid } from '@/components/Icons';
import type { Theme } from '@/lib/types';

interface EventGroup {
  year: number;
  event: string;
  count: number;
  thumbnail_id: number;
}

interface ActiveFilters {
  year?: string;
  event?: string;
  theme?: string;
  favorite?: string;
  untagged?: string;
  q?: string;
}

interface LibraryClientProps {
  groups: EventGroup[];
  total: number;
  filteredTotal: number;
  years: number[];
  themes: Theme[];
  favoriteCount: number;
  untaggedCount: number;
  activeYear: string | null;
  activeFilters: ActiveFilters;
}

export default function LibraryClient({
  groups,
  total,
  filteredTotal,
  years,
  themes,
  favoriteCount,
  untaggedCount,
  activeYear,
  activeFilters,
}: LibraryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState('');
  const [_isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [classifyingYear, setClassifyingYear] = useState(false);
  const [yearProgress, setYearProgress] = useState<{ done: number; total: number } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'folders'>('list');

  // If navigated to a specific event, always use list mode
  const effectiveViewMode = activeFilters.event ? 'list' : viewMode;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  async function handleScan() {
    setScanning(true);
    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      const data = await res.json();
      showToast(`Escaneo completado: ${data.added} fotos nuevas (total: ${data.total})`);
      startTransition(() => router.refresh());
    } catch {
      showToast('Error al escanear la biblioteca');
    } finally {
      setScanning(false);
    }
  }

  function setYear(year: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (year) params.set('year', year);
    else params.delete('year');
    params.delete('event');
    router.push(`/library?${params.toString()}`);
  }

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) params.set('q', query.trim());
    else params.delete('q');
    params.delete('event');
    router.push(`/library?${params.toString()}`);
  }, [query, router, searchParams]);

  async function handleClassifyYear() {
    if (!activeYear) return;
    setClassifyingYear(true);
    setYearProgress({ done: 0, total: groups.length });
    let done = 0;
    for (const group of groups) {
      try {
        await fetch('/api/ai/classify/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year: activeYear, event: group.event }),
        });
      } catch { /* continue */ }
      done++;
      setYearProgress({ done, total: groups.length });
    }
    setClassifyingYear(false);
    setYearProgress(null);
    showToast(`Clasificación del año ${activeYear} completada`);
    startTransition(() => router.refresh());
  }

  const allKeys = useMemo(() => groups.map(g => `${g.year}-${g.event}`), [groups]);
  const allCollapsed = collapsed.size === allKeys.length;

  function toggleGroup(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function collapseAll() { setCollapsed(new Set(allKeys)); }
  function expandAll() { setCollapsed(new Set()); }

  const themeId = searchParams.get('theme');
  const fav = searchParams.get('favorite');
  const activeThemeName = themes.find(t => String(t.id) === themeId)?.name;
  let title = 'Todas las fotos';
  if (fav) title = 'Favoritos';
  else if (activeThemeName) title = activeThemeName;
  else if (activeFilters.event) title = activeFilters.event;
  else if (activeYear) title = activeYear;

  const showClassifyYear = !!activeYear && !activeFilters.event && !fav && !themeId;
  const canToggleView = !activeFilters.event && !fav;

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes}
        totalPhotos={total}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        onScan={handleScan}
        scanning={scanning}
      />

      <div className="main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeFilters.event && (
              <button
                className="back-btn"
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('event');
                  router.push(`/library?${params.toString()}`);
                }}
                title="Volver a carpetas"
              >
                ←
              </button>
            )}
            <div className="topbar-title">{title}</div>
          </div>
          <span className="topbar-sub">{filteredTotal.toLocaleString('es')} fotos</span>
          <div className="topbar-spacer" />
          {canToggleView && (
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${effectiveViewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="Vista lista"
              >
                <IconViewList />
              </button>
              <button
                className={`view-toggle-btn ${effectiveViewMode === 'folders' ? 'active' : ''}`}
                onClick={() => setViewMode('folders')}
                title="Vista carpetas"
              >
                <IconViewGrid />
              </button>
            </div>
          )}
          <form onSubmit={handleSearch}>
            <div className="search-box">
              <IconSearch />
              <input
                placeholder="Buscar fotos, tags, eventos…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </form>
        </div>

        <div className="content">
          {years.length > 1 && (
            <div className="year-tabs">
              <button className={`year-tab ${!activeYear ? 'active' : ''}`} onClick={() => setYear(null)}>
                Todos
              </button>
              {years.map((y) => (
                <button
                  key={y}
                  className={`year-tab ${activeYear === String(y) ? 'active' : ''}`}
                  onClick={() => setYear(String(y))}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {effectiveViewMode === 'folders' ? (
            <FolderGrid groups={groups} showYear={!activeYear} />
          ) : (
            <>
              {(groups.length > 1 || showClassifyYear) && (
                <div className="collapse-controls">
                  {groups.length > 1 && (
                    <button className="collapse-btn" onClick={allCollapsed ? expandAll : collapseAll}>
                      {allCollapsed ? 'Expandir todo' : 'Colapsar todo'}
                    </button>
                  )}
                  {showClassifyYear && (
                    <button
                      className="collapse-btn classify-year-btn"
                      onClick={handleClassifyYear}
                      disabled={classifyingYear}
                    >
                      <IconSparkle size={11} />
                      {classifyingYear
                        ? `Clasificando… (${yearProgress?.done}/${yearProgress?.total} carpetas)`
                        : `Clasificar año ${activeYear}`}
                    </button>
                  )}
                </div>
              )}
              <PhotoGrid
                groups={groups}
                collapsed={collapsed}
                onToggle={toggleGroup}
                activeFilters={activeFilters}
                showYear={!activeYear && !activeFilters.event}
              />
            </>
          )}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
