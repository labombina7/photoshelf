'use client';

import { useState, useTransition, useMemo, useEffect, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PhotoGrid from '@/components/PhotoGrid';
import FolderGrid from '@/components/FolderGrid';
import { IconSparkle, IconViewList, IconViewGrid, IconMenu } from '@/components/Icons';
import Slideshow from '@/components/Slideshow';
import { useHeaderSlot, useHeaderSlotLeft } from '@/components/HeaderSlot';
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
  iso_max?: string;
  aperture_max?: string;
  focal_min?: string;
  focal_max?: string;
  camera?: string;
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
  bannerSlot?: React.ReactNode;
  cameras?: string[];
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
  bannerSlot,
  cameras = [],
}: LibraryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState('');
  const [isPending, startTransition] = useTransition();
  // Restore collapsed state from sessionStorage so that navigating back from a photo
  // detail preserves which groups were open. Falls back to all-expanded on first visit.
  const allGroupKeys = useMemo(() => groups.map(g => `${g.year}-${g.event}`), [groups]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    // When viewing a specific event (arrived from folder click), always expand it
    if (activeFilters.event) return new Set<string>();
    try {
      const stored = sessionStorage.getItem('photoshelf_collapsed');
      if (stored) return new Set<string>(JSON.parse(stored) as string[]);
    } catch {}
    return new Set<string>();
  });

  // When the event filter changes (soft navigation from sidebar), expand all groups
  useEffect(() => {
    if (activeFilters.event) setCollapsed(new Set());
  }, [activeFilters.event]);

  // Keep sessionStorage in sync whenever collapsed changes
  useEffect(() => {
    try { sessionStorage.setItem('photoshelf_collapsed', JSON.stringify(Array.from(collapsed))); } catch {}
  }, [collapsed]);
  const [viewMode, setViewMode] = useState<'list' | 'folders'>('folders');
  const { running: classifyingYear, pending: classifyPending, done: classifyDone, total: classifyTotal, startClassify } = useClassify();
  const [localClassifying, setLocalClassifying] = useState(false);
  const { alert } = useModal();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [slideshowIds, setSlideshowIds] = useState<number[] | null>(null);

  async function openSlideshow() {
    const params = new URLSearchParams();
    if (activeFilters.year) params.set('year', activeFilters.year);
    if (activeFilters.event) params.set('event', activeFilters.event);
    if (activeFilters.theme) params.set('theme', activeFilters.theme);
    if (activeFilters.favorite) params.set('favorite', activeFilters.favorite);
    if (activeFilters.untagged) params.set('untagged', activeFilters.untagged);
    if (activeFilters.q) params.set('q', activeFilters.q);
    params.set('limit', '5000');
    const res = await fetch(`/api/photos?${params.toString()}`);
    const data = await res.json() as { photos: { id: number }[] };
    const ids = data.photos.map(p => p.id);
    if (ids.length > 0) setSlideshowIds(ids);
  }

  // Keep localClassifying in sync: clear it when server confirms no active job
  useEffect(() => {
    if (localClassifying && !classifyingYear && !classifyPending) setLocalClassifying(false);
  }, [classifyingYear, classifyPending, localClassifying]);

  // If navigated to a specific event, always use list mode
  const effectiveViewMode = activeFilters.event ? 'list' : viewMode;

  // P key to open slideshow
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'p' || e.key === 'P') {
        if (slideshowIds) setSlideshowIds(null);
        else void openSlideshow();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideshowIds]);

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

  async function handleClassifyYear(force = false) {
    if (!activeYear) return;
    setLocalClassifying(true);
    try {
      await startClassify(parseInt(activeYear, 10), force);
    } catch (err) {
      setLocalClassifying(false);
      await alert(err instanceof Error ? err.message : 'Error al iniciar la clasificación', {
        title: 'Clasificación en curso',
      });
    }
  }

  const showYearProgress = localClassifying || classifyingYear || classifyPending;

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

  // ── Slot izquierda: solo hamburger en mobile ───────────────────────────────
  useHeaderSlotLeft(
    useMemo(() => (
      <div className="header-slot-library">
        <button
          className="hamburger header-slot-hamburger"
          onClick={() => setMobileSidebarOpen(true)}
          title="Menú"
        >
          <IconMenu size={18} />
        </button>
      </div>
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), []),
  );

  // ── Slot derecha: Presentación + vista toggle ───────────────────────────────
  useHeaderSlot(
    useMemo(() => (
      <div className="header-slot-library">
        {/* Presentación */}
        {filteredTotal > 0 && (
          <button
            className="btn-slideshow"
            onClick={openSlideshow}
            title="Presentación (P)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            <span className="btn-slideshow-label">Presentación</span>
          </button>
        )}

        {/* Vista toggle */}
        {canToggleView && (
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${effectiveViewMode === 'list' ? 'active' : ''}`}
              onClick={() => startTransition(() => setViewMode('list'))}
              title="Vista lista"
            >
              <IconViewList />
            </button>
            <button
              className={`view-toggle-btn ${effectiveViewMode === 'folders' ? 'active' : ''}`}
              onClick={() => startTransition(() => setViewMode('folders'))}
              title="Vista carpetas"
            >
              <IconViewGrid />
            </button>
          </div>
        )}
      </div>
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [filteredTotal, canToggleView, effectiveViewMode]),
  );

  return (
    <div className="app-shell">
      {slideshowIds && (
        <Slideshow
          photoIds={slideshowIds}
          startIndex={0}
          onClose={() => setSlideshowIds(null)}
        />
      )}
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
        cameras={cameras}
      />

      <div className="main">
        {bannerSlot}
        <div className="content">
          {years.length > 1 && (
            <>
              {/* Desktop: chip tabs */}
              <div className="year-tabs year-tabs--desktop" role="tablist" aria-label="Filtrar por año">
                <button
                  className={`year-tab ${!activeYear ? 'active' : ''}`}
                  onClick={() => setYear(null)}
                  role="tab"
                  aria-selected={!activeYear}
                  tabIndex={!activeYear ? 0 : -1}
                >
                  Todos
                </button>
                {years.map((y) => (
                  <button
                    key={y}
                    className={`year-tab ${activeYear === String(y) ? 'active' : ''}`}
                    onClick={() => setYear(String(y))}
                    role="tab"
                    aria-selected={activeYear === String(y)}
                    tabIndex={activeYear === String(y) ? 0 : -1}
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
                onClick={() => handleClassifyYear(false)}
                disabled={showYearProgress}
                style={{ flexShrink: 0 }}
              >
                <IconSparkle size={11} />
                {classifyPending && !classifyingYear
                  ? 'En cola…'
                  : classifyingYear
                  ? 'Clasificando…'
                  : `Clasificar año ${activeYear}`}
              </button>
              {!showYearProgress && (
                <button
                  className="collapse-btn"
                  onClick={() => handleClassifyYear(true)}
                  disabled={showYearProgress}
                  style={{ flexShrink: 0, opacity: 0.7 }}
                  title="Borra los tags de IA existentes y reclasifica todas las fotos del año"
                >
                  <IconSparkle size={11} />
                  Reclasificar
                </button>
              )}
              {showYearProgress && classifyingYear && (
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

          <div style={{ opacity: isPending ? 0 : 1, transition: 'opacity 120ms ease' }}>
          {effectiveViewMode === 'folders' ? (
            <>
              {activeYear && (
                <p className="folder-summary">
                  {groups.length.toLocaleString('es')} álbumes · {filteredTotal.toLocaleString('es')} fotos
                </p>
              )}
              <FolderGrid groups={groups} showYear={!activeYear} />
            </>
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
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
