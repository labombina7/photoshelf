'use client';

import { useState, useTransition, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import FilterBar from '@/components/FilterBar';
import PhotoGrid from '@/components/PhotoGrid';
import FolderGrid from '@/components/FolderGrid';
import { IconSparkle, IconMenu, IconShare } from '@/components/Icons';
import Slideshow from '@/components/Slideshow';
import ShareButton from '@/components/ShareButton';
import { useHeaderSlotLeft } from '@/components/HeaderSlot';
import { useClassify } from '@/components/ClassifyProvider';
import { useModal } from '@/components/ModalProvider';
import { useSlideshow } from '@/hooks/useSlideshow';
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
  favoriteCount: number;
  untaggedCount: number;
  activeYear: string | null;
  activeFilters: ActiveFilters;
  catalogs?: CatalogRow[];
  activeCatalogId?: number;
  hasMemories?: boolean;
  cameras?: string[];
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
  catalogs = [],
  activeCatalogId = 1,
  hasMemories = false,
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
  const { running: classifyingYear, pending: classifyPending, year: classifyActiveYear, done: classifyDone, total: classifyTotal, startClassify } = useClassify();
  // Only show progress for the year currently being classified
  const isThisYearActive = (classifyingYear || classifyPending) && classifyActiveYear === (activeYear ? parseInt(activeYear, 10) : null);
  const [localClassifying, setLocalClassifying] = useState(false);
  const { alert } = useModal();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const { slideshowIds, setSlideshowIds, openSlideshow } = useSlideshow(activeFilters);

  // Keep localClassifying in sync: clear it when server confirms this year's job is done
  useEffect(() => {
    if (localClassifying && !isThisYearActive) setLocalClassifying(false);
  }, [isThisYearActive, localClassifying]);

  // If navigated to a specific event, always use list mode
  const effectiveViewMode = activeFilters.event ? 'list' : viewMode;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

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

  const showYearProgress = localClassifying || isThisYearActive;

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

  function toggleSelectionMode() {
    setSelectionMode(m => !m);
    setSelectedIds(new Set());
  }

  function togglePhotoSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  // ── Slot izquierda: hamburger en mobile ──────────────────────────────────
  useHeaderSlotLeft(
    useMemo(() => (
      <div className="header-slot-library">
        <button className="hamburger header-slot-hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
          <IconMenu size={18} />
        </button>
      </div>
    ), []),
  );

  const handleViewModeChange = useCallback((m: 'list' | 'folders') => startTransition(() => setViewMode(m)), []);

  return (
    <>
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
          totalPhotos={total}
          favoriteCount={favoriteCount}
          untaggedCount={untaggedCount}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          catalogs={catalogs}
          activeCatalogId={activeCatalogId}
        />

        <div className="main">
        <FilterBar
          years={years}
          cameras={cameras}
          activeYear={activeYear}
          activeFilters={{
            year: activeYear,
            camera: activeFilters.camera,
            iso_max: activeFilters.iso_max,
            aperture_max: activeFilters.aperture_max,
            focal_min: activeFilters.focal_min,
            focal_max: activeFilters.focal_max,
          }}
          filteredTotal={filteredTotal}
          viewMode={effectiveViewMode}
          canToggleView={canToggleView}
          onViewModeChange={handleViewModeChange}
          onSlideshow={openSlideshow}
          hasMemories={hasMemories}
        />
        <div className="content">
          {/* Selection mode toolbar */}
          {effectiveViewMode === 'list' && (
            <div className="collapse-controls" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', marginBottom: selectionMode ? 0 : undefined }}>
              <button
                className={`collapse-btn${selectionMode ? ' collapse-btn--active' : ''}`}
                onClick={toggleSelectionMode}
                title={selectionMode ? 'Cancelar selección' : 'Seleccionar fotos para compartir'}
              >
                <IconShare size={11} />
                {selectionMode ? 'Cancelar selección' : 'Seleccionar'}
              </button>
              {selectionMode && selectedIds.size > 0 && (
                <>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {selectedIds.size} {selectedIds.size === 1 ? 'foto' : 'fotos'}
                  </span>
                  <ShareButton
                    photoIds={Array.from(selectedIds)}
                    label={activeFilters.event ?? activeYear ?? 'selección'}
                  />
                </>
              )}
            </div>
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
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={togglePhotoSelect}
              />
            </>
          )}
          </div>
        </div>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}
