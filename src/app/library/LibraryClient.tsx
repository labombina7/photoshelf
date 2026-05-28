'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PhotoGrid from '@/components/PhotoGrid';
import FolderGrid from '@/components/FolderGrid';
import { IconSparkle, IconViewList, IconViewGrid, IconMenu } from '@/components/Icons';
import { useHeaderSlot } from '@/components/HeaderSlot';
import { useClassify } from '@/components/ClassifyProvider';
import { useModal } from '@/components/ModalProvider';
import type { Theme } from '@/lib/types';
import type { CatalogRow } from '@/lib/queries/catalogs';

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
  catalogs?: CatalogRow[];
  activeCatalogId?: number;
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
  catalogs = [],
  activeCatalogId = 1,
}: LibraryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState('');
  const [_isPending, startTransition] = useTransition();
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
  const { running: classifyingYear, done: classifyDone, total: classifyTotal, startClassify } = useClassify();
  const [localClassifying, setLocalClassifying] = useState(false);
  const { alert } = useModal();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Keep localClassifying in sync: clear it when the server confirms done
  useEffect(() => {
    if (localClassifying && !classifyingYear) setLocalClassifying(false);
  }, [classifyingYear, localClassifying]);

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

  async function handleClassifyYear() {
    if (!activeYear) return;
    setLocalClassifying(true);
    try {
      await startClassify(parseInt(activeYear, 10));
    } catch (err) {
      setLocalClassifying(false);
      await alert(err instanceof Error ? err.message : 'Error al iniciar la clasificación', {
        title: 'Clasificación en curso',
      });
    }
  }

  const showYearProgress = localClassifying || classifyingYear;

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

  // ── Inyectar contenido contextual en el AppHeader ──────────────────────────
  useHeaderSlot(
    useMemo(() => (
      <div className="header-slot-library">
        {/* Mobile: hamburger para abrir sidebar */}
        <button
          className="hamburger header-slot-hamburger"
          onClick={() => setMobileSidebarOpen(true)}
          title="Menú"
        >
          <IconMenu size={18} />
        </button>

        {/* Back button cuando se está dentro de un evento */}
        {activeFilters.event && (
          <button
            className="back-btn"
            onClick={() => {
              const params = new URLSearchParams();
              if (activeYear) params.set('year', activeYear);
              router.push(`/library?${params.toString()}`);
            }}
            title="Volver a carpetas"
          >
            ←
          </button>
        )}

        {/* Título + contador */}
        <span className="header-slot-title">{title}</span>
        <span className="header-slot-sub">{filteredTotal.toLocaleString('es')} fotos</span>

        {/* Vista toggle */}
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
      </div>
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [title, filteredTotal, canToggleView, effectiveViewMode, activeFilters.event, activeYear]),
  );

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
        catalogs={catalogs}
        activeCatalogId={activeCatalogId}
      />

      <div className="main">
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
            <div className="collapse-controls" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
              <button
                className="collapse-btn classify-year-btn"
                onClick={handleClassifyYear}
                disabled={showYearProgress}
                style={{ flexShrink: 0 }}
              >
                <IconSparkle size={11} />
                {showYearProgress
                  ? 'Clasificando…'
                  : `Clasificar año ${activeYear}`}
              </button>
              {showYearProgress && (
                <span className="classify-inline-progress">
                  <span className="classify-inline-track">
                    {classifyTotal > 0 && classifyDone > 0
                      ? <span className="classify-inline-fill" style={{ width: `${Math.round((classifyDone / classifyTotal) * 100)}%` }} />
                      : <span className="classify-inline-pulse" />}
                  </span>
                  {classifyTotal > 0 && classifyDone > 0 && (
                    <span className="classify-inline-count">({classifyDone}/{classifyTotal})</span>
                  )}
                </span>
              )}
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
