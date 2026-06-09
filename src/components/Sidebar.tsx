'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { IconViewGrid, IconStar, IconRefresh, IconPlus, IconLogout, IconEdit, IconTrash, IconFolder, IconTag, IconTagEmpty, IconTimeline, IconStats, IconMap, IconCalendar, IconChevronDown, IconCheck, IconShield, IconHeartbeat, IconSmartAlbum } from './Icons';
import { useScan } from './ScanProvider';
import { useModal } from './ModalProvider';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { Theme } from '@/lib/types';
import type { CatalogRow } from '@/lib/queries/catalogs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortenPath(p: string): string {
  if (!p) return '';
  const s = p.replace(/^\/(?:Users|home)\/[^/]+/, '~');
  if (s.length <= 32) return s;
  const parts = s.split('/').filter(Boolean);
  const prefix = s.startsWith('~') ? '~' : '';
  return `${prefix}/…/${parts[parts.length - 1]}`;
}

function activeModule(pathname: string): 'catalog' | 'projects' | 'albums' | 'tools' | 'insights' {
  if (pathname === '/projects' || pathname.startsWith('/projects/')) return 'projects';
  if (pathname === '/smart-albums' || pathname.startsWith('/smart-albums/')) return 'albums';
  if (pathname === '/insights' || pathname.startsWith('/insights/')) return 'insights';
  if (['/jobs', '/stats', '/health', '/about'].some(r => pathname === r || pathname.startsWith(r + '/')) ||
      pathname.startsWith('/tools') || pathname.startsWith('/settings')) return 'tools';
  return 'catalog';
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SidebarProps {
  // Catalog mode
  themes?: Theme[];
  totalPhotos?: number;
  favoriteCount?: number;
  untaggedCount?: number;
  catalogs?: CatalogRow[];
  activeCatalogId?: number;
  // Projects mode
  projects?: { id: number; title: string }[];
  // Albums mode
  smartAlbums?: { id: number; name: string }[];
  // Mobile
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

// ── Catalog sidebar content ───────────────────────────────────────────────────

function CatalogSection({
  themes = [],
  totalPhotos = 0,
  favoriteCount = 0,
  untaggedCount = 0,
  watcher,
  toggleWatcher,
  onNavClick,
  onFilterClick,
  onClearFilters,
}: {
  themes: Theme[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  watcher?: { watching: boolean; enabled: boolean; classifying: boolean; classifyDone: number; classifyTotal: number };
  toggleWatcher?: () => void;
  onNavClick: () => void;
  onFilterClick: (type: string, val: string) => void;
  onClearFilters: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { confirm } = useModal();
  const [showNewTheme, setShowNewTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeColor, setNewThemeColor] = useState('#e8a45a');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const activeTheme = searchParams.get('theme');
  const activeFav = searchParams.get('favorite');

  async function createTheme() {
    if (!newThemeName.trim()) return;
    await fetch('/api/themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newThemeName.trim(), color: newThemeColor }),
    });
    setNewThemeName(''); setShowNewTheme(false); router.refresh();
  }

  function startEdit(theme: Theme) {
    setEditingId(theme.id); setEditName(theme.name); setEditColor(theme.color);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    await fetch(`/api/themes/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), color: editColor }),
    });
    setEditingId(null); router.refresh();
  }

  async function deleteTheme(id: number, name: string) {
    const ok = await confirm(`¿Eliminar la temática "${name}"? Se eliminará de todas las fotos.`, {
      title: 'Eliminar temática', confirmLabel: 'Eliminar', danger: true,
    });
    if (!ok) return;
    await fetch(`/api/themes/${id}`, { method: 'DELETE' });
    if (activeTheme === String(id)) router.push('/library');
    else router.refresh();
  }

  return (
    <>
      <div className="sidebar-section">
        <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Biblioteca
          {watcher?.watching && (
            <button
              onClick={toggleWatcher}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', marginRight: -2 }}
              title={watcher.classifying
                ? `Clasificando fotos… (${watcher.classifyDone}/${watcher.classifyTotal}) · Clic para desactivar`
                : watcher.enabled ? 'Vigilando carpetas · Clic para desactivar' : 'Vigilancia desactivada · Clic para activar'}
              aria-label="Estado del vigilante de carpetas"
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: watcher.enabled ? 'var(--tag-auto-color)' : 'var(--text-tertiary)', boxShadow: watcher.enabled ? '0 0 0 3px rgba(59,98,212,0.15)' : 'none', display: 'block' }} />
            </button>
          )}
        </div>

        <Link href="/library" onClick={onClearFilters}
          className={`sidebar-item ${pathname === '/library' && !activeTheme && !activeFav ? 'active' : ''}`}>
          <IconViewGrid />
          Todas las fotos
          <span className="sidebar-count">{totalPhotos.toLocaleString('es')}</span>
        </Link>

        <Link href="/timeline" onClick={onNavClick}
          className={`sidebar-item ${pathname === '/timeline' ? 'active' : ''}`}>
          <IconTimeline />
          Línea de tiempo
        </Link>

        <Link href="/map" onClick={onNavClick}
          className={`sidebar-item ${pathname === '/map' ? 'active' : ''}`}>
          <IconMap size={14} />
          Mapa
        </Link>

        <Link href="/memories" onClick={onNavClick}
          className={`sidebar-item ${pathname === '/memories' ? 'active' : ''}`}>
          <IconCalendar size={14} />
          Un día como hoy
        </Link>

        <Link href="/library?favorite=1" onClick={() => onFilterClick('favorite', '1')}
          className={`sidebar-item ${activeFav ? 'active' : ''}`}>
          <IconStar />
          Favoritos
          {favoriteCount > 0 && <span className="sidebar-count">{favoriteCount}</span>}
        </Link>

        {untaggedCount > 0 && (
          <Link href="/library?untagged=1" onClick={() => onFilterClick('untagged', '1')}
            className={`sidebar-item ${searchParams.get('untagged') ? 'active' : ''}`}>
            <IconTagEmpty />
            Sin clasificar
            <span className="sidebar-count">{untaggedCount}</span>
          </Link>
        )}

        <Link href="/tags" onClick={onNavClick}
          className={`sidebar-item ${pathname === '/tags' || pathname.startsWith('/tags/') ? 'active' : ''}`}>
          <IconTag />
          Tags
        </Link>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Temáticas</div>

        {themes.map((theme) => {
          if (editingId === theme.id) {
            return (
              <div key={theme.id} style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input className="tag-input" value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  autoFocus />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="color" value={editColor}
                    onChange={e => setEditColor(e.target.value)}
                    style={{ width: 28, height: 28, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
                  <button className="btn-small" onClick={saveEdit} style={{ flex: 1 }}>Guardar</button>
                  <button className="btn-small" onClick={() => setEditingId(null)}
                    style={{ background: 'var(--border)', color: 'var(--text)', flex: 1 }}>Cancelar</button>
                </div>
              </div>
            );
          }
          return (
            <div key={theme.id} style={{ display: 'flex', alignItems: 'center' }}
              onMouseEnter={() => setHoveredId(theme.id)}
              onMouseLeave={() => setHoveredId(null)}>
              <Link href={`/library?theme=${theme.id}`} onClick={() => onFilterClick('theme', theme.name)}
                className={`sidebar-item ${activeTheme === String(theme.id) ? 'active' : ''}`}
                style={{ flex: 1, minWidth: 0 }}>
                <span className="theme-dot" style={{ background: theme.color }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{theme.name}</span>
                {(theme.photo_count ?? 0) > 0 && (
                  <span className="sidebar-count">{theme.photo_count!.toLocaleString('es')}</span>
                )}
              </Link>
              {hoveredId === theme.id && (
                <div style={{ display: 'flex', gap: 2, paddingRight: 8, flexShrink: 0 }}>
                  <button onClick={() => startEdit(theme)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 3, borderRadius: 4 }}
                    title="Editar" aria-label={`Editar temática ${theme.name}`}>
                    <IconEdit />
                  </button>
                  <button onClick={() => deleteTheme(theme.id, theme.name)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 3, borderRadius: 4 }}
                    title="Eliminar" aria-label={`Eliminar temática ${theme.name}`}>
                    <IconTrash />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {showNewTheme ? (
          <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input className="tag-input" placeholder="Nombre de temática" value={newThemeName}
              onChange={e => setNewThemeName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createTheme(); if (e.key === 'Escape') setShowNewTheme(false); }}
              autoFocus />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="color" value={newThemeColor}
                onChange={e => setNewThemeColor(e.target.value)}
                style={{ width: 28, height: 28, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
              <button className="btn-small" onClick={createTheme} style={{ flex: 1 }}>Crear</button>
              <button className="btn-small" onClick={() => setShowNewTheme(false)}
                style={{ background: 'var(--border)', color: 'var(--text)', flex: 1 }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button className="sidebar-item"
            style={{ color: 'var(--text-tertiary)', fontSize: '12.5px', background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => setShowNewTheme(true)} aria-label="Crear nueva temática">
            <IconPlus />
            Nueva temática
          </button>
        )}
      </div>
    </>
  );
}

// ── Projects sidebar content ──────────────────────────────────────────────────

function ProjectsSection({
  projects = [],
  onNavClick,
}: {
  projects: { id: number; title: string }[];
  onNavClick: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/projects" onClick={onNavClick} style={{ color: 'inherit', textDecoration: 'none' }}>
          Proyectos
        </Link>
        {projects.length > 0 && (
          <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', letterSpacing: 0 }}>{projects.length}</span>
        )}
      </div>
      {projects.map(p => (
        <Link key={p.id} href={`/projects/${p.id}`} onClick={onNavClick}
          className={`sidebar-item ${pathname === `/projects/${p.id}` ? 'active' : ''}`}>
          <IconFolder size={14} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
        </Link>
      ))}
    </div>
  );
}

// ── Albums sidebar content ────────────────────────────────────────────────────

const ALBUMS_VISIBLE = 8;

function AlbumsSection({
  smartAlbums = [],
  onNavClick,
}: {
  smartAlbums: { id: number; name: string }[];
  onNavClick: () => void;
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? smartAlbums : smartAlbums.slice(0, ALBUMS_VISIBLE);
  const hidden = smartAlbums.length - ALBUMS_VISIBLE;

  return (
    <div className="sidebar-section">
      <Link href="/smart-albums" onClick={onNavClick}
        className="sidebar-section-label sidebar-section-label--link">
        Álbumes
      </Link>
      {visible.map(a => (
        <Link key={a.id} href={`/smart-albums/${a.id}`} onClick={onNavClick}
          className={`sidebar-item ${pathname === `/smart-albums/${a.id}` ? 'active' : ''}`}>
          <IconSmartAlbum size={14} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
        </Link>
      ))}
      {smartAlbums.length === 0 && (
        <Link href="/smart-albums" onClick={onNavClick}
          style={{ color: 'var(--text-tertiary)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 9, padding: '4px 10px', textDecoration: 'none' }}>
          <IconPlus size={13} />
          Nuevo álbum
        </Link>
      )}
      {smartAlbums.length > ALBUMS_VISIBLE && (
        <button onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12, padding: '4px 8px 4px 28px', textAlign: 'left', width: '100%' }}>
          {expanded ? 'Ver menos ↑' : `+${hidden} más`}
        </button>
      )}
    </div>
  );
}

// ── Insights sidebar content ──────────────────────────────────────────────────

function InsightsSection({ onNavClick }: { onNavClick: () => void }) {
  const pathname = usePathname();
  return (
    <div className="sidebar-section">
      <div className="sidebar-section-label">Tu estilo</div>
      <Link href="/insights" onClick={onNavClick}
        className={`sidebar-item ${pathname === '/insights' ? 'active' : ''}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
        Análisis de estilo
      </Link>
    </div>
  );
}

// ── Tools sidebar content ─────────────────────────────────────────────────────

function ToolsSection({ onNavClick }: { onNavClick: () => void }) {
  const pathname = usePathname();
  const [activeJobCount, setActiveJobCount] = useState(0);
  const [orphanCount, setOrphanCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function pollJobs() {
      try {
        const res = await fetch('/api/jobs');
        if (!res.ok || !mounted) return;
        const data = await res.json() as { jobs: { status: string }[] };
        if (mounted) setActiveJobCount(data.jobs.filter(j => j.status === 'pending' || j.status === 'in_progress').length);
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

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-label">Herramientas</div>
      <Link href="/jobs" onClick={onNavClick}
        className={`sidebar-item ${pathname === '/jobs' ? 'active' : ''}`}>
        <IconCalendar size={14} />
        Cola de trabajos
        {activeJobCount > 0 && (
          <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9, background: '#3b82f6', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', animation: 'pulse 1.5s ease-in-out infinite' }}>
            {activeJobCount}
          </span>
        )}
      </Link>
      <Link href="/stats" onClick={onNavClick}
        className={`sidebar-item ${pathname === '/stats' ? 'active' : ''}`}>
        <IconStats size={14} />
        Estadísticas
      </Link>
      <Link href="/health" onClick={onNavClick}
        className={`sidebar-item ${pathname === '/health' ? 'active' : ''}`}>
        <IconHeartbeat size={14} />
        Salud
      </Link>
      <Link href="/settings/tools" onClick={onNavClick}
        className={`sidebar-item ${pathname.startsWith('/settings/tools') ? 'active' : ''}`}>
        <IconShield size={14} />
        Integridad
        {orphanCount > 0 && (
          <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9, background: '#e67e22', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            {orphanCount}
          </span>
        )}
      </Link>
      <Link href="/settings" onClick={onNavClick}
        className={`sidebar-item ${pathname.startsWith('/settings') ? 'active' : ''}`}>
        <IconViewGrid size={14} />
        Ajustes
      </Link>
      <Link href="/about" onClick={onNavClick}
        className={`sidebar-item ${pathname === '/about' || pathname.startsWith('/about/') ? 'active' : ''}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        Acerca de
      </Link>
    </div>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

function SidebarInner({
  themes = [],
  totalPhotos = 0,
  favoriteCount = 0,
  untaggedCount = 0,
  catalogs = [],
  activeCatalogId = 1,
  projects = [],
  smartAlbums = [],
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { running, startScan, watcher, toggleWatcher } = useScan();
  const { alert } = useModal();
  const { track } = useAnalytics();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);

  const module = activeModule(pathname);
  const isCatalog = module === 'catalog';

  useEffect(() => {
    function onOpen() { setEventOpen(true); }
    window.addEventListener('photoshelf:sidebar-open', onOpen);
    return () => window.removeEventListener('photoshelf:sidebar-open', onOpen);
  }, []);

  const isMobileOpen = mobileOpen || eventOpen;
  function closeMobile() { setEventOpen(false); onMobileClose?.(); }

  const swipeTouchStartX = useRef<number | null>(null);
  function handleSidebarTouchStart(e: React.TouchEvent) {
    if (!e.touches.length) return;
    swipeTouchStartX.current = e.touches[0].clientX;
  }
  function handleSidebarTouchEnd(e: React.TouchEvent) {
    if (swipeTouchStartX.current === null || !e.changedTouches.length) return;
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

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function handleScan() {
    try {
      await startScan();
    } catch (err) {
      await alert(err instanceof Error ? err.message : 'Error al iniciar el análisis', { title: 'Análisis en curso' });
    }
  }

  function handleNavClick() { closeMobile(); }
  function handleFilterClick(type: string, val: string) {
    track('sidebar_filter_applied', { filter_type: type, filter_value: val });
    closeMobile();
  }
  function handleClearFilters() { track('sidebar_filter_cleared'); closeMobile(); }

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
        {/* Contenido dinámico según módulo */}
        {module === 'catalog' && (
          <CatalogSection
            themes={themes}
            totalPhotos={totalPhotos}
            favoriteCount={favoriteCount}
            untaggedCount={untaggedCount}
            watcher={watcher}
            toggleWatcher={toggleWatcher}
            onNavClick={handleNavClick}
            onFilterClick={handleFilterClick}
            onClearFilters={handleClearFilters}
          />
        )}
        {module === 'projects' && (
          <ProjectsSection projects={projects} onNavClick={handleNavClick} />
        )}
        {module === 'albums' && (
          <AlbumsSection smartAlbums={smartAlbums} onNavClick={handleNavClick} />
        )}
        {module === 'tools' && (
          <ToolsSection onNavClick={handleNavClick} />
        )}
        {module === 'insights' && (
          <InsightsSection onNavClick={handleNavClick} />
        )}

        <div className="sidebar-spacer" />

        {/* Reescanear — solo en catálogo */}
        {isCatalog && (
          <div style={{ padding: '0 18px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={handleScan} disabled={running} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: 'var(--text-secondary)', cursor: running ? 'not-allowed' : 'pointer', opacity: running ? 0.6 : 1 }}>
              {running ? <span className="spinner dark" aria-hidden="true" /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>}
              {running ? 'Escaneando…' : 'Reescanear biblioteca'}
            </button>
          </div>
        )}

        {/* Footer: catálogo activo + logout */}
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
            <button onClick={handleLogout} className="sidebar-logout-btn" title="Cerrar sesión" aria-label="Cerrar sesión">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
          {catalogOpen && catalogs.length > 1 && (
            <div className="sidebar-catalog-menu">
              {catalogs.map(cat => (
                <button key={cat.id}
                  className={`sidebar-catalog-option${cat.id === activeCatalogId ? ' active' : ''}`}
                  onClick={() => { switchCatalog(cat.id); setCatalogOpen(false); }}>
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
