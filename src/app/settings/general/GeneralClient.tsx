'use client';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import { IconMenu } from '@/components/Icons';
import { useHeaderSlotLeft } from '@/components/HeaderSlot';
import type { Theme } from '@/lib/types';
import type { CatalogRow } from '@/lib/queries/catalogs';

interface WatcherState {
  enabled: boolean;
  watching: boolean;
  classifying: boolean;
  classifyDone: number;
  classifyTotal: number;
}

interface Props {
  themes: Theme[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs?: CatalogRow[];
  activeCatalogId?: number;
}

export default function GeneralClient({
  themes,
  totalPhotos,
  favoriteCount,
  untaggedCount,
  catalogs = [],
  activeCatalogId,
}: Props) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [watcher, setWatcher] = useState<WatcherState | null>(null);
  const [watcherLoading, setWatcherLoading] = useState(false);

  useEffect(() => {
    fetch('/api/watcher/status')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setWatcher(d as WatcherState); })
      .catch(() => null);
  }, []);

  async function toggleWatcher() {
    if (!watcher || watcherLoading) return;
    const next = !watcher.enabled;
    setWatcherLoading(true);
    try {
      const res = await fetch('/api/watcher/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      if (res.ok) {
        const d = await res.json() as WatcherState;
        setWatcher(d);
      }
    } catch {
      // silent
    } finally {
      setWatcherLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useHeaderSlotLeft(useMemo(() => (
    <div className="header-slot-library">
      <button className="hamburger header-slot-hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
        <IconMenu size={20} />
      </button>
    </div>
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
        <div style={{ padding: '24px 32px', maxWidth: 640 }}>
          {/* ── Watcher ───────────────────────────────────────── */}
          <section style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Vigilancia de carpetas</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Detecta automáticamente fotos nuevas o eliminadas en las carpetas de los catálogos.
            </div>

            {watcher === null ? (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Cargando…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={watcher.enabled}
                    onChange={toggleWatcher}
                    disabled={watcherLoading}
                    style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 13 }}>Activar vigilancia de carpetas</span>
                </label>

                {watcher.enabled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 25, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: watcher.watching ? '#22c55e' : '#e05252',
                      flexShrink: 0,
                    }} />
                    {watcher.classifying
                      ? `Clasificando fotos… (${watcher.classifyDone}/${watcher.classifyTotal})`
                      : watcher.watching
                        ? 'Vigilando carpetas'
                        : 'Inactivo'}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Contraseña ────────────────────────────────────── */}
          <section style={{ borderTop: '1px solid var(--border)', paddingTop: 28, marginBottom: 36 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Contraseña</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Cambia la contraseña de acceso a photoshelf.
            </div>
            <div style={{
              padding: '12px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              color: 'var(--text-tertiary)',
            }}>
              El cambio de contraseña estará disponible próximamente.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
