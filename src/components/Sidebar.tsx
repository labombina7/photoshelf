'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { IconPhoto, IconGrid, IconStar, IconSearch, IconRefresh, IconPlus, IconLogout, IconEdit, IconTrash } from './Icons';
import type { Theme } from '@/lib/types';

interface SidebarProps {
  themes: Theme[];
  totalPhotos: number;
  favoriteCount?: number;
  untaggedCount?: number;
  onScan?: () => void;
  scanning?: boolean;
}

export default function Sidebar({
  themes,
  totalPhotos,
  favoriteCount = 0,
  untaggedCount = 0,
  onScan,
  scanning = false,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showNewTheme, setShowNewTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeColor, setNewThemeColor] = useState('#e8a45a');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [hoveredId, setHoveredId] = useState<number | null>(null);

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

  async function deleteTheme(id: number, name: string) {
    if (!confirm(`¿Eliminar la temática "${name}"? Se eliminará de todas las fotos.`)) return;
    await fetch(`/api/themes/${id}`, { method: 'DELETE' });
    if (activeTheme === String(id)) router.push('/library');
    else router.refresh();
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <IconPhoto size={18} />
        <span className="sidebar-logo-name">photoshelf</span>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Biblioteca</div>

        <Link
          href="/library"
          className={`sidebar-item ${pathname === '/library' && !activeTheme && !activeFav ? 'active' : ''}`}
        >
          <IconGrid />
          Todas las fotos
          <span className="sidebar-count">{totalPhotos.toLocaleString('es')}</span>
        </Link>

        <Link
          href="/library?favorite=1"
          className={`sidebar-item ${activeFav ? 'active' : ''}`}
        >
          <IconStar />
          Favoritos
          {favoriteCount > 0 && <span className="sidebar-count">{favoriteCount}</span>}
        </Link>

        {untaggedCount > 0 && (
          <Link
            href="/library?untagged=1"
            className={`sidebar-item ${searchParams.get('untagged') ? 'active' : ''}`}
          >
            <IconSearch />
            Sin clasificar
            <span className="sidebar-count">{untaggedCount}</span>
          </Link>
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
                  >
                    <IconEdit />
                  </button>
                  <button
                    onClick={() => deleteTheme(theme.id, theme.name)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 3, borderRadius: 4 }}
                    title="Eliminar"
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
          <div
            className="sidebar-item"
            style={{ color: 'var(--text-tertiary)', fontSize: '12.5px' }}
            onClick={() => setShowNewTheme(true)}
          >
            <IconPlus />
            Nueva temática
          </div>
        )}
      </div>

      <div className="sidebar-spacer" />

      <div style={{ padding: '0 18px 12px' }}>
        <button
          onClick={onScan}
          disabled={scanning}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 10px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', background: 'transparent',
            fontFamily: 'inherit', fontSize: 13, color: 'var(--text-secondary)',
            cursor: scanning ? 'not-allowed' : 'pointer', opacity: scanning ? 0.6 : 1,
          }}
        >
          <IconRefresh />
          {scanning ? 'Escaneando…' : 'Reescanear biblioteca'}
        </button>
      </div>

      <div className="sidebar-user">
        <div className="avatar">PS</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">photoshelf</div>
          <div className="sidebar-user-sub">/photos</div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', marginLeft: 'auto', padding: 4,
          }}
          title="Cerrar sesión"
        >
          <IconLogout />
        </button>
      </div>
    </aside>
  );
}
