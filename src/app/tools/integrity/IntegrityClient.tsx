'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import { IconMenu, IconShield, IconRefresh, IconCheck, IconTrash, IconAlertTriangle } from '@/components/Icons';
import { useHeaderSlotLeft } from '@/components/HeaderSlot';
import type { Theme } from '@/lib/types';
import type { IntegrityReport } from '@/lib/queries/integrity';
import type { CatalogRow } from '@/lib/queries/catalogs';

interface Meta {
  total: number;
  orphans: number;
  unindexed: number;
  corrupt: number;
  orphanThumbnails: number;
  lastRun: string | null;
}

interface StatusResponse {
  running: boolean;
  phase: string;
  checked: number;
  total: number;
  orphansFound: number;
  unindexedFound: number;
  corruptFound: number;
  orphanThumbnailsFound: number;
  error: string | null;
  completedAt: number | null;
}

interface ReportResponse {
  meta: Meta;
  items: IntegrityReport[];
  lastRunState: { phase: string; completedAt: number | null; error: string | null };
}

interface Props {
  initialMeta: Meta;
  themes: Theme[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs?: CatalogRow[];
  activeCatalogId?: number;
  topSlot?: React.ReactNode;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

function StatusBadge({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '16px 24px', background: 'var(--surface)',
      border: `1px solid ${count > 0 ? color : 'var(--border)'}`,
      borderRadius: 'var(--radius)', gap: 4, minWidth: 120,
    }}>
      <span style={{ fontSize: 28, fontWeight: 700, color: count > 0 ? color : 'var(--text)', letterSpacing: -1 }}>
        {count}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
    </div>
  );
}

function ReportSection({
  title,
  items,
  actionLabel,
  actionColor,
  onAction,
  actionLoading,
}: {
  title: string;
  items: IntegrityReport[];
  actionLabel: string;
  actionColor: string;
  onAction: (ids: number[]) => void;
  actionLoading: boolean;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState(true);

  if (items.length === 0) return null;

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map(i => i.id)));
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text)', fontWeight: 600, fontSize: 13 }}
        >
          {expanded ? '▾' : '▸'} {title} ({items.length})
        </button>
        {expanded && selected.size > 0 && (
          <button
            onClick={() => onAction(Array.from(selected))}
            disabled={actionLoading}
            style={{
              marginLeft: 'auto', padding: '4px 12px', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${actionColor}`, background: 'transparent',
              color: actionColor, fontSize: 12, cursor: actionLoading ? 'not-allowed' : 'pointer',
              opacity: actionLoading ? 0.6 : 1,
            }}
          >
            {actionLoading ? 'Procesando…' : `${actionLabel} (${selected.size})`}
          </button>
        )}
      </div>
      {expanded && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)' }}>
            <input type="checkbox" checked={selected.size === items.length} onChange={toggleAll} style={{ marginRight: 10 }} />
            Ruta
          </div>
          {items.map((item, i) => (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', padding: '7px 12px',
                fontSize: 12, fontFamily: 'monospace',
                borderBottom: i < items.length - 1 ? '1px solid var(--border-light)' : 'none',
                background: selected.has(item.id) ? 'var(--tag-auto-bg)' : 'var(--surface)',
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => {
                  const s = new Set(selected);
                  s.has(item.id) ? s.delete(item.id) : s.add(item.id);
                  setSelected(s);
                }}
                style={{ marginRight: 10, flexShrink: 0 }}
              />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                {item.path}
              </span>
              {item.error_msg && (
                <span style={{ fontSize: 11, color: 'var(--danger)', marginLeft: 8, flexShrink: 0 }}>
                  {item.error_msg}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IntegrityClient({
  initialMeta,
  themes,
  totalPhotos,
  favoriteCount,
  untaggedCount,
  catalogs = [],
  activeCatalogId = 1,
  topSlot,
}: Props) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [meta, setMeta] = useState<Meta>(initialMeta);
  const [items, setItems] = useState<IntegrityReport[]>([]);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [includeCorrupt, setIncludeCorrupt] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const isRunning = status?.running ?? false;
  const buttonBusy = starting || isRunning;

  const fetchReport = useCallback(async () => {
    const res = await fetch('/api/integrity/report');
    if (!res.ok) return;
    const data: ReportResponse = await res.json();
    setMeta(data.meta);
    setItems(data.items);
  }, []);

  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/integrity/status');
    if (!res.ok) return;
    const data: StatusResponse = await res.json();
    setStatus(data);
    if (!data.running && data.completedAt) {
      await fetchReport();
    }
  }, [fetchReport]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(fetchStatus, 1500);
    return () => clearInterval(id);
  }, [isRunning, fetchStatus]);

  const startScan = async () => {
    setMessage(null);
    setStarting(true);
    const res = await fetch('/api/integrity/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ includeCorrupt }),
    });
    setStarting(false);
    if (res.ok) {
      setStatus(s => ({ ...(s ?? {} as StatusResponse), running: true, phase: 'orphans', checked: 0, total: 0, orphansFound: 0, unindexedFound: 0, corruptFound: 0, error: null, completedAt: null }));
      fetchStatus();
    } else {
      const err = await res.json();
      setMessage(err.error ?? 'Error al iniciar el análisis');
    }
  };

  const handleAction = async (action: string, ids: number[]) => {
    setActionLoading(action);
    setMessage(null);
    try {
      const res = await fetch('/api/integrity/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? 'Error');
      } else if (action === 'remove_orphans') {
        setMessage(`${data.removed} registro(s) huérfano(s) eliminados de la base de datos.`);
        await fetchReport();
      } else if (action === 'quarantine_corrupt') {
        setMessage(`${data.moved} archivo(s) movidos a _quarantine/.${data.errors?.length ? ` ${data.errors.length} error(es).` : ''}`);
        await fetchReport();
      } else if (action === 'delete_orphan_thumbnails') {
        setMessage(`${data.removed} thumbnail(s) huérfano(s) eliminados de la caché.${data.errors?.length ? ` ${data.errors.length} error(es).` : ''}`);
        await fetchReport();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const phaseLabel: Record<string, string> = {
    orphans: 'Fase 1: verificando huérfanos en base de datos…',
    unindexed: 'Fase 2: buscando archivos no indexados en disco…',
    corrupt: 'Fase 3: verificando cabeceras de imagen…',
    orphan_thumbnails: 'Fase 4: detectando thumbnails huérfanos en caché…',
    done: 'Análisis completo',
    idle: '',
  };

  const orphanItems = items.filter(i => i.type === 'orphan');
  const unindexedItems = items.filter(i => i.type === 'unindexed');
  const corruptItems = items.filter(i => i.type === 'corrupt');
  const orphanThumbnailItems = items.filter(i => i.type === 'orphan_thumbnail');
  const hasResults = items.length > 0;
  const allClean = hasResults === false && meta.lastRun !== null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useHeaderSlotLeft(useMemo(() => (
    <div className="header-slot-library">
      <button className="hamburger header-slot-hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
        <IconMenu size={20} />
      </button>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), []));

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes}
        totalPhotos={totalPhotos}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        catalogs={catalogs}
        activeCatalogId={activeCatalogId}
      />

      <div className="main">
        <div className="content" style={{ maxWidth: 800 }}>

          {topSlot}

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Verificación de integridad</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                Detecta archivos huérfanos en la base de datos, fotos no indexadas en disco y archivos corruptos.
              </p>
            </div>
          </div>

          {/* Controls */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 20, marginBottom: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <button
                onClick={startScan}
                disabled={buttonBusy}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'var(--accent)', color: '#fff',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                  cursor: buttonBusy ? 'not-allowed' : 'pointer', opacity: buttonBusy ? 0.6 : 1,
                }}
              >
                {buttonBusy ? <span className="spinner" aria-hidden="true" /> : <IconShield size={14} />}
                {starting ? 'Iniciando…' : isRunning ? 'Analizando…' : 'Verificar integridad'}
              </button>

              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeCorrupt}
                  onChange={e => setIncludeCorrupt(e.target.checked)}
                  disabled={buttonBusy}
                />
                Incluir verificación de cabecera (más lento)
              </label>

              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
                Último análisis: {fmtDate(meta.lastRun)}
              </span>
            </div>

            {/* Progress */}
            {isRunning && status && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {phaseLabel[status.phase] ?? status.phase}
                  {status.total > 0 && ` ${status.checked} / ${status.total}`}
                </div>
                {status.total > 0 && (
                  <div style={{ height: 4, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', background: 'var(--accent)', borderRadius: 2,
                      width: `${Math.round((status.checked / status.total) * 100)}%`,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>Huérfanos: {status.orphansFound}</span>
                  <span>No indexados: {status.unindexedFound}</span>
                  {includeCorrupt && <span>Corruptos: {status.corruptFound}</span>}
                  <span>Thumbnails huérfanos: {status.orphanThumbnailsFound}</span>
                </div>
              </div>
            )}
          </div>

          {/* Message */}
          {message && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 16,
              background: 'var(--tag-auto-bg)', border: '1px solid var(--tag-auto-border)',
              fontSize: 13, color: 'var(--tag-auto-color)',
            }}>
              {message}
            </div>
          )}

          {/* Summary cards */}
          {meta.lastRun && !isRunning && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              <StatusBadge count={meta.orphans} label="Huérfanos" color="var(--warning)" />
              <StatusBadge count={meta.unindexed} label="No indexados" color="#3498db" />
              <StatusBadge count={meta.corrupt} label="Corruptos" color="var(--danger)" />
              <StatusBadge count={meta.orphanThumbnails} label="Thumbs huérfanos" color="#8e44ad" />
            </div>
          )}

          {/* Clean state */}
          {allClean && !isRunning && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '16px 20px', background: '#f0faf4',
              border: '1px solid #a8e6c0', borderRadius: 'var(--radius)',
              color: '#1a7a40', fontSize: 13,
            }}>
              <IconCheck size={16} />
              Tu biblioteca está íntegra. No se han encontrado problemas.
            </div>
          )}

          {/* Report sections */}
          {!isRunning && hasResults && (
            <div>
              <ReportSection
                title="Archivos huérfanos (en DB, sin fichero en disco)"
                items={orphanItems}
                actionLabel="Eliminar de la base de datos"
                actionColor="var(--warning)"
                onAction={ids => handleAction('remove_orphans', ids)}
                actionLoading={actionLoading === 'remove_orphans'}
              />
              <ReportSection
                title="Archivos no indexados (en disco, sin registro en DB)"
                items={unindexedItems}
                actionLabel="Re-escanear"
                actionColor="#3498db"
                onAction={ids => handleAction('rescan_unindexed', ids)}
                actionLoading={actionLoading === 'rescan_unindexed'}
              />
              <ReportSection
                title="Archivos corruptos (cabecera inválida)"
                items={corruptItems}
                actionLabel="Mover a cuarentena"
                actionColor="var(--danger)"
                onAction={ids => handleAction('quarantine_corrupt', ids)}
                actionLoading={actionLoading === 'quarantine_corrupt'}
              />
              <ReportSection
                title="Thumbnails huérfanos (en caché, sin foto en BD)"
                items={orphanThumbnailItems}
                actionLabel="Eliminar de caché"
                actionColor="#8e44ad"
                onAction={ids => handleAction('delete_orphan_thumbnails', ids)}
                actionLoading={actionLoading === 'delete_orphan_thumbnails'}
              />
            </div>
          )}

          {/* Empty state before first run */}
          {!meta.lastRun && !isRunning && (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconAlertTriangle size={14} />
              Todavía no se ha ejecutado ningún análisis. Pulsa "Verificar integridad" para comenzar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
