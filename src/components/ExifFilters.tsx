'use client';

import { useState } from 'react';

export interface ExifFilterValues {
  iso_max?: string;
  aperture_max?: string;
  focal_min?: string;
  focal_max?: string;
  camera?: string;
}

interface ExifFiltersProps {
  cameras: string[];
  activeFilters: ExifFilterValues;
  onChange: (filters: ExifFilterValues) => void;
}

export default function ExifFilters({ cameras, activeFilters, onChange }: ExifFiltersProps) {
  const [open, setOpen] = useState(false);

  const isoOptions = [
    { label: '≤400',  value: '400' },
    { label: '≤1600', value: '1600' },
    { label: '≤6400', value: '6400' },
  ];

  const apertureOptions = [
    { label: '≤f/2',   value: '2' },
    { label: '≤f/2.8', value: '2.8' },
    { label: '≤f/4',   value: '4' },
    { label: '≤f/8',   value: '8' },
  ];

  function setFilter(key: keyof ExifFilterValues, value: string | undefined) {
    onChange({ ...activeFilters, [key]: value });
  }

  function clearAll() {
    onChange({});
  }

  const hasActive = Object.values(activeFilters).some(v => v !== undefined && v !== '');

  return (
    <div style={{ padding: '0 0 4px' }}>
      <button
        className="sidebar-item"
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', width: '100%', textAlign: 'left',
          cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', fontSize: 13,
        }}
        aria-expanded={open}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Técnico
          {hasActive && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--tag-auto-color)', display: 'inline-block',
            }} />
          )}
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '4px 10px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* ISO */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ISO</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {isoOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilter('iso_max', activeFilters.iso_max === opt.value ? undefined : opt.value)}
                  style={{
                    padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)', cursor: 'pointer',
                    fontSize: 12, fontFamily: 'inherit',
                    background: activeFilters.iso_max === opt.value ? 'var(--tag-auto-bg)' : 'transparent',
                    color: activeFilters.iso_max === opt.value ? 'var(--tag-auto-color)' : 'var(--text-secondary)',
                    borderColor: activeFilters.iso_max === opt.value ? 'var(--tag-auto-color)' : 'var(--border)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Apertura */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Apertura</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {apertureOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilter('aperture_max', activeFilters.aperture_max === opt.value ? undefined : opt.value)}
                  style={{
                    padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)', cursor: 'pointer',
                    fontSize: 12, fontFamily: 'inherit',
                    background: activeFilters.aperture_max === opt.value ? 'var(--tag-auto-bg)' : 'transparent',
                    color: activeFilters.aperture_max === opt.value ? 'var(--tag-auto-color)' : 'var(--text-secondary)',
                    borderColor: activeFilters.aperture_max === opt.value ? 'var(--tag-auto-color)' : 'var(--border)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cámara */}
          {cameras.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cámara</div>
              <select
                value={activeFilters.camera ?? ''}
                onChange={e => setFilter('camera', e.target.value || undefined)}
                style={{
                  width: '100%', padding: '4px 6px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                <option value="">Todas las cámaras</option>
                {cameras.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {/* Clear */}
          {hasActive && (
            <button
              onClick={clearAll}
              style={{
                padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', cursor: 'pointer',
                fontSize: 11, fontFamily: 'inherit',
                background: 'transparent', color: 'var(--text-tertiary)',
                alignSelf: 'flex-start',
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
