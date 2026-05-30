'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { IconMenu, IconTrash, IconEdit } from '@/components/Icons';
import { useModal } from '@/components/ModalProvider';
import type { Theme } from '@/lib/types';
import type { CatalogRow } from '@/lib/queries/catalogs';

interface Props {
  catalogs: CatalogRow[];
  activeCatalogId: number;
  themes: Theme[];
  projects: { id: number; title: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  sidebarCatalogs?: CatalogRow[];
}

export default function CatalogsClient({
  catalogs: initialCatalogs,
  activeCatalogId,
  themes,
  projects,
  totalPhotos,
  favoriteCount,
  untaggedCount,
  sidebarCatalogs = [],
}: Props) {
  const router = useRouter();
  const { confirm, alert } = useModal();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [catalogs, setCatalogs] = useState(initialCatalogs);

  // Form state
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  async function refresh() {
    const res = await fetch('/api/catalogs');
    if (res.ok) {
      const data = await res.json() as { catalogs: CatalogRow[] };
      setCatalogs(data.catalogs);
    }
  }

  async function createCatalog() {
    setCreateError(null);
    if (!newName.trim()) { setCreateError('El nombre es obligatorio'); return; }
    if (!newPath.trim()) { setCreateError('La ruta es obligatoria'); return; }
    const res = await fetch('/api/catalogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), path: newPath.trim() }),
    });
    if (!res.ok) {
      const err = await res.json() as { error?: string };
      setCreateError(err.error ?? 'Error al crear el catálogo');
      return;
    }
    setNewName('');
    setNewPath('');
    await refresh();
    startTransition(() => router.refresh());
  }

  async function saveRename(id: number) {
    if (!editName.trim()) return;
    const res = await fetch(`/api/catalogs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (!res.ok) {
      const err = await res.json() as { error?: string };
      await alert(err.error ?? 'Error al renombrar', { title: 'Error' });
      return;
    }
    setEditingId(null);
    await refresh();
    startTransition(() => router.refresh());
  }

  async function deleteCatalog(id: number, name: string) {
    const ok = await confirm(
      `¿Eliminar el catálogo "${name}"? Se eliminarán también todas las fotos registradas en él.`,
      { title: 'Eliminar catálogo', confirmLabel: 'Eliminar', danger: true },
    );
    if (!ok) return;
    const res = await fetch(`/api/catalogs/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json() as { error?: string };
      await alert(err.error ?? 'Error al eliminar', { title: 'Error' });
      return;
    }
    await refresh();
    startTransition(() => router.refresh());
  }

  async function switchTo(id: number) {
    await fetch('/api/catalogs/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalogId: id }),
    });
    // Hard navigation — bypasses Next.js router cache and re-reads session cookie
    window.location.href = '/library';
  }

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes}
        projects={projects}
        totalPhotos={totalPhotos}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        catalogs={sidebarCatalogs}
        activeCatalogId={activeCatalogId}
      />

      <div className="main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
              <IconMenu size={20} />
            </button>
            <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Catálogos</h1>
          </div>
        </div>

        <div style={{ padding: '24px 32px', maxWidth: 640 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
            Cada catálogo apunta a una carpeta de fotos independiente. Escribe la ruta completa tal como aparece en el NAS.
          </p>

          {/* Add new catalog — at the top so it's accessible on mobile without scrolling */}
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Añadir catálogo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                className="tag-input"
                placeholder="Nombre (p.ej. Archivo 2010–2015)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={{ width: '100%' }}
              />
              <input
                className="tag-input"
                placeholder="Ruta de la carpeta (p.ej. /volume1/homes/javi/MobileBackup)"
                value={newPath}
                onChange={e => setNewPath(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createCatalog(); }}
                style={{ width: '100%' }}
              />
              {createError && (
                <div style={{ fontSize: 12, color: 'var(--danger, #e05252)' }}>{createError}</div>
              )}
              <div>
                <button className="btn-small" onClick={createCatalog} disabled={isPending}>
                  Crear catálogo
                </button>
              </div>
            </div>
          </div>

          {/* Catalog list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {catalogs.map(cat => (
              <div key={cat.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                border: `1px solid ${cat.id === activeCatalogId ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                background: cat.id === activeCatalogId ? 'rgba(var(--accent-rgb), 0.06)' : 'transparent',
              }}>
                {editingId === cat.id ? (
                  <>
                    <input
                      className="tag-input"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveRename(cat.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      style={{ flex: 1 }}
                    />
                    <button className="btn-small" onClick={() => saveRename(cat.id)}>Guardar</button>
                    <button
                      className="btn-small"
                      onClick={() => setEditingId(null)}
                      style={{ background: 'var(--border)', color: 'var(--text)' }}
                    >Cancelar</button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {cat.name}
                        {cat.id === activeCatalogId && (
                          <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            activo
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cat.path} · {cat.photo_count.toLocaleString('es')} fotos
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {cat.id !== activeCatalogId && (
                        <button
                          className="btn-small"
                          onClick={() => switchTo(cat.id)}
                          disabled={isPending}
                        >
                          Activar
                        </button>
                      )}
                      <button
                        onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}
                        title="Renombrar"
                      >
                        <IconEdit size={14} />
                      </button>
                      {cat.id !== 1 && (
                        <button
                          onClick={() => deleteCatalog(cat.id, cat.name)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}
                          title="Eliminar"
                        >
                          <IconTrash size={14} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
