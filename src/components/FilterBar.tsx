'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAnalytics } from '@/hooks/useAnalytics';

export interface FilterBarValues {
  year?: string | null;
  camera?: string;
  iso_max?: string;
  aperture_max?: string;
  focal_min?: string;
  focal_max?: string;
}

interface FilterBarProps {
  years: number[];
  cameras: string[];
  activeYear: string | null;
  activeFilters: FilterBarValues;
}

const ISO_OPTIONS = [
  { label: '≤400',  value: '400' },
  { label: '≤1600', value: '1600' },
  { label: '≤6400', value: '6400' },
];

const APERTURE_OPTIONS = [
  { label: '≤f/2',   value: '2' },
  { label: '≤f/2.8', value: '2.8' },
  { label: '≤f/4',   value: '4' },
  { label: '≤f/8',   value: '8' },
];

const YEAR_VISIBLE = 5;

// ── Bottom sheet para mobile ────────────────────────────────────────────────
function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="filter-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="filter-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="filter-sheet-handle" />
        <div className="filter-sheet-title">{title}</div>
        <div className="filter-sheet-body">{children}</div>
      </div>
    </>
  );
}

// ── Dropdown unificado (desktop: dropdown ↓, mobile: bottom sheet) ──────────
function FilterDropdown({
  label,
  options,
  value,
  onChange,
  wide = false,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isMobile]);

  const active = value !== undefined && value !== '';
  const activeLabel = options.find(o => o.value === value)?.label;
  const close = useCallback(() => setOpen(false), []);

  const optionItems = options.map(opt => (
    <button
      key={opt.value}
      role="option"
      aria-selected={value === opt.value}
      className={`filter-bar-dropdown-item${value === opt.value ? ' active' : ''}`}
      onClick={() => { onChange(value === opt.value ? undefined : opt.value); setOpen(false); }}
    >
      {opt.label}
    </button>
  ));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className={`filter-bar-btn${active ? ' filter-bar-btn--active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open && !isMobile}
        aria-haspopup="listbox"
      >
        {active ? activeLabel : label}
        <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 2 }}>▾</span>
      </button>

      {/* Desktop: dropdown */}
      {!isMobile && open && (
        <div className={`filter-bar-dropdown${wide ? ' filter-bar-dropdown--wide' : ''}`} role="listbox">
          {optionItems}
        </div>
      )}

      {/* Mobile: bottom sheet */}
      {isMobile && (
        <BottomSheet open={open} title={label} onClose={close}>
          <div role="listbox">{optionItems}</div>
        </BottomSheet>
      )}
    </div>
  );
}

// ── FilterBar principal ─────────────────────────────────────────────────────
export default function FilterBar({ years, cameras, activeYear, activeFilters }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { track } = useAnalytics();
  const [yearsExpanded, setYearsExpanded] = useState(false);

  const visibleYears = yearsExpanded ? years : years.slice(0, YEAR_VISIBLE);
  const hiddenCount = years.length - YEAR_VISIBLE;

  const activeExifCount = [
    activeFilters.camera,
    activeFilters.iso_max,
    activeFilters.aperture_max,
    activeFilters.focal_min,
    activeFilters.focal_max,
  ].filter(Boolean).length;

  const activeCount = (activeYear ? 1 : 0) + activeExifCount;

  function setYear(year: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', year ?? 'all');
    params.delete('event');
    router.push(`/library?${params.toString()}`);
  }

  function setExifFilter(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
      track('filter_bar_applied', { filter_type: key, filter_value: value });
    } else {
      params.delete(key);
    }
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
      {/* Chips de año */}
      {years.length > 1 && (
        <div className="filter-bar-years" role="group" aria-label="Filtrar por año">
          <button
            className={`filter-bar-year${!activeYear ? ' filter-bar-year--active' : ''}`}
            onClick={() => setYear(null)}
          >
            Todos
          </button>
          {visibleYears.map(y => (
            <button
              key={y}
              className={`filter-bar-year${activeYear === String(y) ? ' filter-bar-year--active' : ''}`}
              onClick={() => setYear(String(y))}
            >
              {y}
            </button>
          ))}
          {years.length > YEAR_VISIBLE && (
            <button
              className="filter-bar-year filter-bar-year--more"
              onClick={() => setYearsExpanded(e => !e)}
            >
              {yearsExpanded ? 'Ver menos ↑' : `+${hiddenCount} más`}
            </button>
          )}
        </div>
      )}

      {/* Separador */}
      {years.length > 1 && cameras.length > 0 && (
        <div className="filter-bar-sep" aria-hidden="true" />
      )}

      {/* Filtros EXIF */}
      <div className="filter-bar-exif">
        {cameras.length > 0 && (
          <FilterDropdown
            label="Cámara"
            options={cameras.map(c => ({ label: c, value: c }))}
            value={activeFilters.camera}
            onChange={v => setExifFilter('camera', v)}
            wide
          />
        )}
        <FilterDropdown
          label="ISO"
          options={ISO_OPTIONS}
          value={activeFilters.iso_max}
          onChange={v => setExifFilter('iso_max', v)}
        />
        <FilterDropdown
          label="Apertura"
          options={APERTURE_OPTIONS}
          value={activeFilters.aperture_max}
          onChange={v => setExifFilter('aperture_max', v)}
        />
      </div>

      {/* Pill limpiar filtros */}
      {activeCount > 0 && (
        <button
          className="filter-bar-clear"
          onClick={clearAll}
          aria-label={`Limpiar ${activeCount} filtro${activeCount !== 1 ? 's' : ''} activo${activeCount !== 1 ? 's' : ''}`}
        >
          ✕ {activeCount} {activeCount !== 1 ? 'activos' : 'activo'}
        </button>
      )}
    </div>
  );
}
