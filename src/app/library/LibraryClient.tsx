'use client';

import { useState, useTransition, useCallback, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PhotoGrid from '@/components/PhotoGrid';
import FolderGrid from '@/components/FolderGrid';
import { IconSearch, IconSparkle, IconViewList, IconViewGrid, IconMenu } from '@/components/Icons';
import AISearchPanel from '@/components/AISearchPanel';
import { useClassify } from '@/components/ClassifyProvider';
import { useModal } from '@/components/ModalProvider';
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
  projects?: { id: number; title: string }[];
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
  projects = [],
  favoriteCount,
  untaggedCount,
  activeYear,
  activeFilters,
}: LibraryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState('');
  const [_isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  // Restore collapsed state from sessionStorage so that navigating back from a photo
  // detail preserves which groups were open. Falls back to all-collapsed on first visit.
  const allGroupKeys = useMemo(() => groups.map(g => `${g.year}-${g.event}`), [groups]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    // When viewing a specific event (arrived from folder click), always expand it
    if (activeFilters.event) return new Set<string>();
    try {
      const stored = sessionStorage.getItem('photoshelf_collapsed');
      if (stored) return new Set<string>(JSON.parse(stored) as string[]);
    } catch {}
    return new Set(allGroupKeys);
  });

  // Keep sessionStorage in sync whenever collapsed changes
  useEffect(() => {
    try { sessionStorage.setItem('photoshelf_collapsed', JSON.stringify(Array.from(collapsed))); } catch {}
  }, [collapsed]);
  const [viewMode, setViewMode] = useState<'list' | 'folders'>('folders');
  const { running: classifyingYear, startClassify } = useClassify();
  const { alert } = useModal();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // If navigated to a specific event, always use list mode
  const effectiveViewMode = activeFilters.event ? 'list' : viewMode;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  function setYear(year: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    // Use 'all' sentinel so the server doesn't redirect back to current year
    params.set('year', year ?? 'all');
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
    try {
      await startClassify(parseInt(activeYear, 10));
    } catch (err) {
      await alert(err instanceof Error ? err.message : 'Error al iniciar la clasificación', {
        title: 'Clasificación en curso',
      });
    }
  }

  const allKeys = allGroupKeys;
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
        projects={projects}
        totalPhotos={total}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <div className="main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
              <IconMenu size={20} />
            </button>
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
          <AISearchPanel />
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
            <>
              {/* Desktop: chip tabs */}
              <div className="year-tabs year-tabs--desktop">
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
              {/* Mobile: native select */}
              <div className="year-select-wrap year-tabs--mobile">
                <select
                  className="year-select"
                  value={activeYear ?? ''}
                  onChange={(e) => setYear(e.target.value || null)}
                >
                  <option value="">Todos los años</option>
                  {years.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Classify-year button is shown in both views */}
          {showClassifyYear && (
            <div className="collapse-controls">
              <button
                className="collapse-btn classify-year-btn"
                onClick={handleClassifyYear}
                disabled={classifyingYear}
              >
                <IconSparkle size={11} />
                {classifyingYear
                  ? 'Clasificando…'
                  : `Clasificar año ${activeYear}`}
              </button>
            </div>
          )}

          {effectiveViewMode === 'folders' ? (
            <FolderGrid groups={groups} showYear={!activeYear} />
          ) : (
            <>
              {groups.length > 1 && (
                <div className="collapse-controls">
                  <button className="collapse-btn" onClick={allCollapsed ? expandAll : collapseAll}>
                    {allCollapsed ? 'Expandir todo' : 'Colapsar todo'}
                  </button>
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
