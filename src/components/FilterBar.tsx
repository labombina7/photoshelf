'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAnalytics } from '@/hooks/useAnalytics';
import { IconShare } from '@/components/Icons';

export interface FilterBarValues {
  year?: string | null;
  camera?: string;
  iso_max?: string;
  aperture_max?: string;
  focal_min?: string;
  focal_max?: string;
}

export interface FilterBarProps {
  years: number[];
  cameras: string[];
  activeYear: string | null;
  activeFilters: FilterBarValues;
  // View controls (Presentación + lista/grid)
  filteredTotal?: number;
  viewMode?: 'list' | 'folders';
  canToggleView?: boolean;
  onViewModeChange?: (mode: 'list' | 'folders') => void;
  onSlideshow?: () => void;
  hasMemories?: boolean;
  // Selection mode
  selectionMode?: boolean;
  onToggleSelection?: () => void;
}

const ISO_OPTIONS     = [{ label: '≤400', value: '400' }, { label: '≤1600', value: '1600' }, { label: '≤6400', value: '6400' }];
const APERTURE_OPTIONS = [{ label: '≤f/2', value: '2' }, { label: '≤f/2.8', value: '2.8' }, { label: '≤f/4', value: '4' }, { label: '≤f/8', value: '8' }];

// ── Bottom sheet (mobile) ─────────────────────────────────────────────────────

function BottomSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  // Portal a document.body: evita que position:sticky + overflow-x:auto del filter-bar
  // rompa el contexto de position:fixed en iOS Safari (el sheet aparecía fuera de pantalla).
  return createPortal(
    <>
      <div className="filter-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="filter-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="filter-sheet-handle" />
        <div className="filter-sheet-title">{title}</div>
        <div className="filter-sheet-body">{children}</div>
      </div>
    </>,
    document.body
  );
}

// ── Generic dropdown (desktop ↓ / mobile bottom sheet) ───────────────────────

function FilterDropdown({ label, options, value, onChange, wide = false }: {
  label: string;
  options: { label: string; value: string }[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Inicialización síncrona: evita que el dropdown desktop (position:absolute, clipado por
  // overflow-x:auto del filter-bar) se renderice en el primer frame en mobile.
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    function onPD(e: PointerEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('pointerdown', onPD);
    return () => document.removeEventListener('pointerdown', onPD);
  }, [isMobile]);

  const active = value !== undefined && value !== '';
  const activeLabel = options.find(o => o.value === value)?.label;
  const close = useCallback(() => setOpen(false), []);

  const items = options.map(opt => (
    <button key={opt.value} role="option" aria-selected={value === opt.value}
      className={`filter-bar-dropdown-item${value === opt.value ? ' active' : ''}`}
      onClick={() => { onChange(value === opt.value ? undefined : opt.value); setOpen(false); }}>
      {opt.label}
    </button>
  ));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={`filter-bar-btn${active ? ' filter-bar-btn--active' : ''}`}
        onClick={() => setOpen(o => !o)} aria-expanded={open && !isMobile} aria-haspopup="listbox">
        {active ? activeLabel : label}
        <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 2 }}>▾</span>
      </button>
      {!isMobile && open && (
        <div className={`filter-bar-dropdown${wide ? ' filter-bar-dropdown--wide' : ''}`} role="listbox">
          {items}
        </div>
      )}
      {isMobile && <BottomSheet open={open} title={label} onClose={close}><div role="listbox">{items}</div></BottomSheet>}
    </div>
  );
}

// ── View toggle icons ─────────────────────────────────────────────────────────

function IconList() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
}
function IconGrid() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

export default function FilterBar({
  years, cameras, activeYear, activeFilters,
  filteredTotal = 0, viewMode = 'folders', canToggleView = false,
  onViewModeChange, onSlideshow, hasMemories = false,
  selectionMode = false, onToggleSelection,
}: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { track } = useAnalytics();

  const activeExifCount = [activeFilters.camera, activeFilters.iso_max, activeFilters.aperture_max, activeFilters.focal_min, activeFilters.focal_max].filter(Boolean).length;
  const activeCount = (activeYear ? 1 : 0) + activeExifCount;

  function setExifFilter(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) { params.set(key, value); track('filter_bar_applied', { filter_type: key, filter_value: value }); }
    else params.delete(key);
    router.push(`/library?${params.toString()}`);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    ['year', 'iso_max', 'aperture_max', 'focal_min', 'focal_max', 'camera'].forEach(k => params.delete(k));
    track('filter_bar_cleared');
    router.push(`/library?${params.toString()}`);
  }

  if (years.length === 0 && cameras.length === 0) return null;

  return (
    <div className="filter-bar">
      {/* Año como dropdown */}
      <FilterDropdown
        label="Año"
        options={[{ label: 'Todos los años', value: '' }, ...years.map(y => ({ label: String(y), value: String(y) }))]}
        value={activeYear ?? ''}
        onChange={v => {
          const params = new URLSearchParams(searchParams.toString());
          params.set('year', v || 'all');
          params.delete('event');
          router.push(`/library?${params.toString()}`);
        }}
      />

      {/* Separador */}
      {cameras.length > 0 && <div className="filter-bar-sep" aria-hidden="true" />}

      {/* Filtros EXIF */}
      <div className="filter-bar-exif">
        {cameras.length > 0 && (
          <FilterDropdown label="Cámara"
            options={cameras.map(c => ({ label: c, value: c }))}
            value={activeFilters.camera}
            onChange={v => setExifFilter('camera', v)}
            wide />
        )}
        <FilterDropdown label="ISO" options={ISO_OPTIONS} value={activeFilters.iso_max} onChange={v => setExifFilter('iso_max', v)} />
        <FilterDropdown label="Apertura" options={APERTURE_OPTIONS} value={activeFilters.aperture_max} onChange={v => setExifFilter('aperture_max', v)} />
      </div>

      {/* Limpiar */}
      {activeCount > 0 && (
        <button className="filter-bar-clear" onClick={clearAll}
          aria-label={`Limpiar ${activeCount} filtro${activeCount !== 1 ? 's' : ''} activo${activeCount !== 1 ? 's' : ''}`}>
          ✕ {activeCount} {activeCount !== 1 ? 'activos' : 'activo'}
        </button>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Chip "Un día como hoy" */}
      {hasMemories && (
        <Link href="/memories" className="filter-bar-memories-chip" title="Ver recuerdos de hoy">
          <span className="filter-bar-memories-dot" aria-hidden="true" />
          Un día como hoy
        </Link>
      )}

      {/* Acciones de vista */}
      <div className="filter-bar-actions">
        {filteredTotal > 0 && onSlideshow && (
          <button className="btn-slideshow" onClick={onSlideshow} title="Presentación (P)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            <span className="btn-slideshow-label">Presentación</span>
          </button>
        )}
        {canToggleView && onViewModeChange && (
          <div className="view-toggle">
            <button className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
              onClick={() => onViewModeChange('list')} title="Vista lista">
              <IconList />
            </button>
            <button className={`view-toggle-btn${viewMode === 'folders' ? ' active' : ''}`}
              onClick={() => onViewModeChange('folders')} title="Vista carpetas">
              <IconGrid />
            </button>
          </div>
        )}
        {viewMode === 'list' && onToggleSelection && (
          <button
            className={`view-toggle-btn${selectionMode ? ' active' : ''}`}
            onClick={onToggleSelection}
            title={selectionMode ? 'Cancelar selección' : 'Seleccionar fotos para compartir'}
          >
            <IconShare size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
