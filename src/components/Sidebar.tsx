'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { IconShelf, IconViewGrid, IconStar, IconSearch, IconRefresh, IconPlus, IconLogout, IconEdit, IconTrash, IconFolder, IconTag, IconTagEmpty, IconTimeline, IconStats, IconMap, IconCalendar, IconChevronDown, IconCheck, IconShield, IconHeartbeat, IconSmartAlbum } from './Icons';
import { useScan } from './ScanProvider';
import { useModal } from './ModalProvider';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { Theme } from '@/lib/types';
import type { CatalogRow } from '@/lib/queries/catalogs';
import ExifFilters, { type ExifFilterValues } from './ExifFilters';

const ALBUMS_VISIBLE = 5;

function SmartAlbumsSidebarSection({
  smartAlbums,
  pathname,
  onNavClick,
}: {
  smartAlbums: { id: number; name: string }[];
  pathname: string;
  onNavClick: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasActive = smartAlbums.some(a => pathname === `/smart-albums/${a.id}`);

  // Auto-expand if the active album is beyond the visible fold
  const activeIdx = smartAlbums.findIndex(a => pathname === `/smart-albums/${a.id}`);
  const shouldAutoExpand = activeIdx >= ALBUMS_VISIBLE;
  const isExpanded = expanded || shouldAutoExpand;

  const visible = isExpanded ? smartAlbums : smartAlbums.slice(0, ALBUMS_VISIBLE);
  const hidden  = smartAlbums.length - ALBUMS_VISIBLE;

  return (
    <div className="sidebar-section">
      <Link
        href="/smart-albums"
        onClick={onNavClick}
        className="sidebar-section-label sidebar-section-label--link"
      >
        Álbumes
      </Link>
      {visible.map(a => (
        <Link
          key={a.id}
          href={`/smart-albums/${a.id}`}
          onClick={onNavClick}
          className={`sidebar-item ${pathname === `/smart-albums/${a.id}` ? 'active' : ''}`}
        >
          <IconSmartAlbum size={14} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
        </Link>
      ))}
      {smartAlbums.length === 0 && (
        <div className="sidebar-item" style={{ color: 'var(--text-tertiary)', fontSize: '12.5px' }}>
          <Link href="/smart-albums" onClick={onNavClick} style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: 9 }}>
            <IconPlus size={13} />
            Nuevo álbum
          </Link>
        </div>
      )}
      {smartAlbums.length > ALBUMS_VISIBLE && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', fontSize: '12px',
            padding: '4px 8px 4px 28px', textAlign: 'left', width: '100%',
          }}
        >
          {isExpanded ? 'Ver menos ↑' : `+${hidden} más`}
        </button>
      )}
    </div>
  );
}

function shortenPath(p: string): string {
  if (!p) return '';
  const s = p.replace(/^\/(?:Users|home)\/[^/]+/, '~');
  if (s.length <= 32) return s;
  // Si sigue siendo largo, muestra ~/…/últimasegmento
  const parts = s.split('/').filter(Boolean);
  const prefix = s.startsWith('~') ? '~' : '';
  return `${prefix}/…/${parts[parts.length - 1]}`;
}

interface SidebarProps {
  themes: Theme[];
  projects?: { id: number; title: string }[];
  smartAlbums?: { id: number; name: string }[];
  totalPhotos: number;
  favoriteCount?: number;
  untaggedCount?: number;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  catalogs?: CatalogRow[];
  activeCatalogId?: number;
  cameras?: string[];
}

function SidebarInner({
  themes,
  projects = [],
  smartAlbums = [],
  totalPhotos,
  favoriteCount = 0,
  untaggedCount = 0,
  mobileOpen = false,
  onMobileClose,
  catalogs = [],
  activeCatalogId = 1,
  cameras = [],
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { running, startScan, watcher, toggleWatcher } = useScan();
  const { confirm, alert } = useModal();
  const { track } = useAnalytics();
  const [showNewTheme, setShowNewTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeColor, setNewThemeColor] = useState('#e8a45a');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [eventOpen,   setEventOpen]   = useState(false);
  const [exifFilters, setExifFilters] = useState<ExifFilterValues>({});
  const [orphanCount, setOrphanCount] = useState(0);
  const [activeJobCount, setActiveJobCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function pollJobs() {
      try {
        const res = await fetch('/api/jobs');
        if (!res.ok || !mounted) return;
        const data = await res.json() as { jobs: { status: string }[] };
        const count = data.jobs.filter(j => j.status === 'pending' || j.status === 'in_progress').length;
        if (mounted) setActiveJobCount(count);
      } catch { /* ignore */ }
    }
    pollJobs();
    const interval = setInterval(pollJobs, 3000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    fetch('/api/integrity/status')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && !data.running) {
          fetch('/api/integrity/report')
            .then(r => r.ok ? r.json() : null)
            .then(rep => { if (rep) setOrphanCount(rep.meta.orphans ?? 0); })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [pathname]);

  // Listen for event-based open requests (e.g. from pages that can't pass props)
  useEffect(() => {
    function onOpen() { setEventOpen(true); }
    window.addEventListener('photoshelf:sidebar-open', onOpen);
    return () => window.removeEventListener('photoshelf:sidebar-open', onOpen);
  }, []);

  const isMobileOpen = mobileOpen || eventOpen;
  function closeMobile() { setEventOpen(false); onMobileClose?.(); }

  // Swipe-left to close sidebar on mobile
  const swipeTouchStartX = useRef<number | null>(null);
  function handleSidebarTouchStart(e: React.TouchEvent) {
    if (!e.touches.length) return;
    swipeTouchStartX.current = e.touches[0].clientX;
  }
  function handleSidebarTouchEnd(e: React.TouchEvent) {
    if (swipeTouchStartX.current === null) return;
    if (!e.changedTouches.length) return;
    const deltaX = e.changedTouches[0].clientX - swipeTouchStartX.current;
    swipeTouchStartX.current = null;
    if (deltaX < -60) closeMobile();
  }

  const activeCatalog = catalogs.find(c => c.id === activeCatalogId);

  async function switchCatalog(id: number) {
    if (id === activeCatalogId) return;
    await fetch('/api/catalogs/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalogId: id }),
    });
    window.location.href = '/library';
  }

  const activeTheme = searchParams.get('theme');
  const activeFav = searchParams.get('favorite');

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function createTheme() {
    if (!newThemeName.trim()) return;
    await fetch('/api/themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newThemeName.trim(), color: newThemeColor }),
    });
    setNewThemeName('');
    setShowNewTheme(false);
    router.refresh();
  }

  function startEdit(theme: Theme) {
    setEditingId(theme.id);
    setEditName(theme.name);
    setEditColor(theme.color);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    await fetch(`/api/themes/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), color: editColor }),
    });
    setEditingId(null);
    router.refresh();
  }

  async function handleScan() {
    try {
      await startScan();
    } catch (err) {
      await alert(err instanceof Error ? err.message : 'Error al iniciar el análisis', {
        title: 'Análisis en curso',
      });
    }
  }

  async function deleteTheme(id: number, name: string) {
    const ok = await confirm(`¿Eliminar la temática "${name}"? Se eliminará de todas las fotos.`, {
      title: 'Eliminar temática',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/themes/${id}`, { method: 'DELETE' });
    if (activeTheme === String(id)) router.push('/library');
    else router.refresh();
  }

  function handleNavClick() {
    closeMobile();
  }

  function handleFilterClick(filterType: string, filterValue: string) {
    track('sidebar_filter_applied', { filter_type: filterType, filter_value: filterValue });
    closeMobile();
  }

  function handleClearFilters() {
    track('sidebar_filter_cleared');
    closeMobile();
  }

  function handleExifChange(filters: ExifFilterValues) {
    setExifFilters(filters);
    const params = new URLSearchParams(searchParams.toString());
    // Clear existing exif params
    ['iso_max', 'aperture_max', 'focal_min', 'focal_max', 'camera'].forEach(k => params.delete(k));
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(k, v);
    }
    const hasFilters = Object.values(filters).some(Boolean);
    if (hasFilters) track('sidebar_filter_applied', { filter_type: 'exif', filter_value: JSON.stringify(filters) });
    router.push(`/library?${params.toString()}`);
  }

  return (
    <>
      {isMobileOpen && <div className="sidebar-overlay" onClick={closeMobile} />}
    <aside
      className={`sidebar${isMobileOpen ? ' mobile-open' : ''}`}
      role="navigation"
      aria-label="Navegación principal"
      onTouchStart={handleSidebarTouchStart}
      onTouchEnd={handleSidebarTouchEnd}
    >
      <div className="sidebar-section">
        <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Biblioteca
          {watcher.watching && (
            <button
              onClick={toggleWatcher}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '2px 4px', flexShrink: 0,
                display: 'flex', alignItems: 'center',
              }}
              title={
                watcher.classifying
                  ? `Clasificando fotos… (${watcher.classifyDone}/${watcher.classifyTotal}) · Clic para desactivar`
                  : watcher.enabled
                    ? 'Vigilando carpetas · Monitorización automática activa · Clic para desactivar'
                    : 'Vigilancia desactivada · Clic para activar monitorización automática'
              }
              aria-label="Estado del vigilante de carpetas"
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: watcher.enabled ? 'var(--tag-auto-color)' : 'var(--text-tertiary)',
                boxShadow: watcher.enabled ? '0 0 0 3px rgba(59,98,212,0.15)' : 'none',
                display: 'block',
              }} />
            </button>
          )}
        </div>

        <Link
          href="/library"
          onClick={handleClearFilters}
          className={`sidebar-item ${pathname === '/library' && !activeTheme && !activeFav ? 'active' : ''}`}
        >
          <IconViewGrid />
          Todas las fotos
          <span className="sidebar-count">{totalPhotos.toLocaleString('es')}</span>
        </Link>

        <Link
          href="/timeline"
          onClick={handleNavClick}
          className={`sidebar-item ${pathname === '/timeline' ? 'active' : ''}`}
        >
          <IconTimeline />
          Línea de tiempo
        </Link>

        <Link
          href="/map"
          onClick={handleNavClick}
          className={`sidebar-item ${pathname === '/map' ? 'active' : ''}`}
        >
          <IconMap size={14} />
          Mapa
        </Link>

        <Link
          href="/memories"
          onClick={handleNavClick}
          className={`sidebar-item ${pathname === '/memories' ? 'active' : ''}`}
        >
          <IconCalendar size={14} />
          Un día como hoy
        </Link>

        <Link
          href="/library?favorite=1"
          onClick={() => handleFilterClick('favorite', '1')}
          className={`sidebar-item ${activeFav ? 'active' : ''}`}
        >
          <IconStar />
          Favoritos
          {favoriteCount > 0 && <span className="sidebar-count">{favoriteCount}</span>}
        </Link>

        {untaggedCount > 0 && (
          <Link
            href="/library?untagged=1"
            onClick={() => handleFilterClick('untagged', '1')}
            className={`sidebar-item ${searchParams.get('untagged') ? 'active' : ''}`}
          >
            <IconTagEmpty />
            Sin clasificar
            <span className="sidebar-count">{untaggedCount}</span>
          </Link>
        )}

        <Link
          href="/tags"
          onClick={handleNavClick}
          className={`sidebar-item ${pathname === '/tags' || pathname.startsWith('/tags/') ? 'active' : ''}`}
        >
          <IconTag />
          Tags
        </Link>

        {totalPhotos > 0 && (
          <ExifFilters
            cameras={cameras}
            activeFilters={exifFilters}
            onChange={handleExifChange}
          />
        )}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Temáticas</div>

        {themes.map((theme) => {
          if (editingId === theme.id) {
            return (
              <div key={theme.id} style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  className="tag-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    style={{ width: 28, height: 28, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }}
                  />
                  <button className="btn-small" onClick={saveEdit} style={{ flex: 1 }}>Guardar</button>
                  <button
                    className="btn-small"
                    onClick={() => setEditingId(null)}
                    style={{ background: 'var(--border)', color: 'var(--text)', flex: 1 }}
                  >Cancelar</button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={theme.id}
              style={{ display: 'flex', alignItems: 'center' }}
              onMouseEnter={() => setHoveredId(theme.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <Link
                href={`/library?theme=${theme.id}`}
                onClick={() => handleFilterClick('theme', theme.name)}
                className={`sidebar-item ${activeTheme === String(theme.id) ? 'active' : ''}`}
                style={{ flex: 1, minWidth: 0 }}
              >
                <span className="theme-dot" style={{ background: theme.color }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{theme.name}</span>
                {(theme.photo_count ?? 0) > 0 && (
                  <span className="sidebar-count">{theme.photo_count!.toLocaleString('es')}</span>
                )}
              </Link>
              {hoveredId === theme.id && (
                <div style={{ display: 'flex', gap: 2, paddingRight: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => startEdit(theme)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 3, borderRadius: 4 }}
                    title="Editar"
                    aria-label={`Editar temática ${theme.name}`}
                  >
                    <IconEdit />
                  </button>
                  <button
                    onClick={() => deleteTheme(theme.id, theme.name)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 3, borderRadius: 4 }}
                    title="Eliminar"
                    aria-label={`Eliminar temática ${theme.name}`}
                  >
                    <IconTrash />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {showNewTheme ? (
          <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              className="tag-input"
              placeholder="Nombre de temática"
              value={newThemeName}
              onChange={(e) => setNewThemeName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createTheme(); if (e.key === 'Escape') setShowNewTheme(false); }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="color"
                value={newThemeColor}
                onChange={(e) => setNewThemeColor(e.target.value)}
                style={{ width: 28, height: 28, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }}
              />
              <button className="btn-small" onClick={createTheme} style={{ flex: 1 }}>Crear</button>
              <button
                className="btn-small"
                onClick={() => setShowNewTheme(false)}
                style={{ background: 'var(--border)', color: 'var(--text)', flex: 1 }}
              >Cancelar</button>
            </div>
          </div>
        ) : (
          <button
            className="sidebar-item"
            style={{ color: 'var(--text-tertiary)', fontSize: '12.5px', background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => setShowNewTheme(true)}
            aria-label="Crear nueva temática"
          >
            <IconPlus />
            Nueva temática
          </button>
        )}
      </div>

      <div className="sidebar-section">
        <Link
          href="/projects"
          onClick={handleNavClick}
          className="sidebar-section-label sidebar-section-label--link"
        >
          Portfolio
        </Link>
        {projects.map(p => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            onClick={handleNavClick}
            className={`sidebar-item ${pathname === `/projects/${p.id}` ? 'active' : ''}`}
          >
            <IconFolder size={14} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
          </Link>
        ))}
        {projects.length === 0 && (
          <div className="sidebar-item" style={{ color: 'var(--text-tertiary)', fontSize: '12.5px' }}>
            <Link href="/projects" onClick={handleNavClick} style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: 9 }}>
              <IconPlus size={13} />
              Nuevo proyecto
            </Link>
          </div>
        )}
      </div>

      <SmartAlbumsSidebarSection smartAlbums={smartAlbums} pathname={pathname} onNavClick={handleNavClick} />

      <div className="sidebar-section">
        <div className="sidebar-section-label">Herramientas</div>
        <Link
          href="/jobs"
          onClick={handleNavClick}
          className={`sidebar-item ${pathname === '/jobs' ? 'active' : ''}`}
        >
          <IconCalendar size={14} />
          Cola de trabajos
          {activeJobCount > 0 && (
            <span style={{
              marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9,
              background: '#3b82f6', color: '#fff', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}>
              {activeJobCount}
            </span>
          )}
        </Link>
        <Link
          href="/stats"
          onClick={handleNavClick}
          className={`sidebar-item ${pathname === '/stats' ? 'active' : ''}`}
        >
          <IconStats size={14} />
          Estadísticas
        </Link>
        <Link
          href="/health"
          onClick={handleNavClick}
          className={`sidebar-item ${pathname === '/health' ? 'active' : ''}`}
        >
          <IconHeartbeat size={14} />
          Salud
        </Link>
        <Link
          href="/tools/integrity"
          onClick={handleNavClick}
          className={`sidebar-item ${pathname === '/tools/integrity' ? 'active' : ''}`}
          style={{ position: 'relative' }}
        >
          <IconShield size={14} />
          Integridad
          {orphanCount > 0 && (
            <span style={{
              marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9,
              background: '#e67e22', color: '#fff', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
            }}>
              {orphanCount}
            </span>
          )}
        </Link>
        <Link
          href="/tools/roadmap"
          onClick={handleNavClick}
          className={`sidebar-item ${pathname === '/tools/roadmap' ? 'active' : ''}`}
        >
          <IconCalendar size={14} />
          Roadmap
        </Link>
        <Link
          href="/settings/catalogs"
          onClick={handleNavClick}
          className={`sidebar-item ${pathname === '/settings/catalogs' ? 'active' : ''}`}
        >
          <IconViewGrid size={14} />
          Catálogos
        </Link>
      </div>

      <div className="sidebar-spacer" />

      <div style={{ padding: '0 18px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={handleScan}
          disabled={running}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 10px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', background: 'transparent',
            fontFamily: 'inherit', fontSize: 13, color: 'var(--text-secondary)',
            cursor: running ? 'not-allowed' : 'pointer', opacity: running ? 0.6 : 1,
          }}
        >
          {running ? <span className="spinner dark" aria-hidden="true" /> : <IconRefresh />}
          {running ? 'Escaneando…' : 'Reescanear biblioteca'}
        </button>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-footer-row">
          <button
            className="sidebar-catalog-btn"
            onClick={() => catalogs.length > 1 ? setCatalogOpen(o => !o) : router.push('/settings/catalogs')}
            title={catalogs.length > 1 ? 'Cambiar catálogo' : 'Gestionar catálogos'}
          >
            <div className="sidebar-catalog-text">
              <span className="sidebar-catalog-name">{activeCatalog?.name ?? 'Principal'}</span>
              <span className="sidebar-catalog-path">{shortenPath(activeCatalog?.path ?? '')}</span>
            </div>
            <IconChevronDown size={10} />
          </button>
          <button
            onClick={handleLogout}
            className="sidebar-logout-btn"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <IconLogout size={14} />
          </button>
        </div>
        {catalogOpen && catalogs.length > 1 && (
          <div className="sidebar-catalog-menu">
            {catalogs.map(cat => (
              <button
                key={cat.id}
                className={`sidebar-catalog-option${cat.id === activeCatalogId ? ' active' : ''}`}
                onClick={() => { switchCatalog(cat.id); setCatalogOpen(false); }}
              >
                <span className="catalog-dot" />
                <span style={{ flex: 1 }}>{cat.name}</span>
                {cat.photo_count > 0 && <span className="sidebar-count">{cat.photo_count.toLocaleString('es')}</span>}
                {cat.id === activeCatalogId && <IconCheck size={11} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
    </>
  );
}

export default function Sidebar(props: SidebarProps) {
  return (
    <Suspense>
      <SidebarInner {...props} />
    </Suspense>
  );
}
