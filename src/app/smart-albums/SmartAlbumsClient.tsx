'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { IconSmartAlbum, IconPlus, IconTrash, IconEdit, IconMenu } from '@/components/Icons';
import SmartAlbumBuilder from './SmartAlbumBuilder';
import UnstructuredCatalogBanner from '@/components/UnstructuredCatalogBanner';
import { useModal } from '@/components/ModalProvider';
import type { Theme } from '@/lib/types';
import type { CatalogRow } from '@/lib/queries/catalogs';
import type { AlbumRule } from '@/lib/smartAlbumQuery';

interface AlbumItem {
  id: number;
  name: string;
  rules: string;
  created_at: string;
  photo_count: number;
  cover_photo_id: number | null;
}

interface SmartAlbumsClientProps {
  albums: AlbumItem[];
  themes: Theme[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs: CatalogRow[];
  activeCatalogId: number;
  catalogName: string;
  isUnstructured: boolean;
  alreadyOrganized: boolean;
}

function describeRules(rulesJson: string): string {
  try {
    const rules: AlbumRule[] = JSON.parse(rulesJson);
    if (!Array.isArray(rules) || rules.length === 0) return 'Sin filtros';
    const parts = rules.map(r => {
      if (r.field === 'year') {
        if (r.op === 'eq') return `Año ${r.value}`;
        if (r.op === 'gte') return `Desde ${r.value}`;
        if (r.op === 'lte') return `Hasta ${r.value}`;
      }
      if (r.field === 'tag') return `Tag: ${r.value}`;
      if (r.field === 'theme') return `Temática: ${r.value}`;
      if (r.field === 'favorite') return r.op === 'is_true' ? 'Favoritas' : 'No favoritas';
      if (r.field === 'camera') return `Cámara: ${r.value}`;
      if (r.field === 'no_tags') return 'Sin tags';
      if (r.field === 'taken_after') return `Desde ${r.value?.slice(0, 10)}`;
      if (r.field === 'taken_before') return `Hasta ${r.value?.slice(0, 10)}`;
      return '';
    }).filter(Boolean);
    return parts.join(' · ') || 'Sin filtros';
  } catch {
    return 'Sin filtros';
  }
}

type SortKey = 'date_desc' | 'date_asc' | 'name_asc' | 'photos_desc';

function sortAlbums(albums: AlbumItem[], key: SortKey): AlbumItem[] {
  return [...albums].sort((a, b) => {
    if (key === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (key === 'date_asc')  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (key === 'name_asc')  return a.name.localeCompare(b.name, 'es');
    if (key === 'photos_desc') return b.photo_count - a.photo_count;
    return 0;
  });
}

export default function SmartAlbumsClient({
  albums: initialAlbums,
  themes,
  totalPhotos,
  favoriteCount,
  untaggedCount,
  catalogs,
  activeCatalogId,
  catalogName,
  isUnstructured,
  alreadyOrganized,
}: SmartAlbumsClientProps) {
  const router = useRouter();
  const { confirm } = useModal();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<AlbumItem | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date_desc');

  async function handleCreate(name: string, rules: AlbumRule[]) {
    const res = await fetch('/api/smart-albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rules }),
    });
    if (!res.ok) throw new Error('Error al crear');
    const { id } = await res.json() as { id: number };
    setShowBuilder(false);
    router.push(`/smart-albums/${id}`);
  }

  async function handleEdit(name: string, rules: AlbumRule[]) {
    if (!editingAlbum) return;
    await fetch(`/api/smart-albums/${editingAlbum.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rules }),
    });
    setEditingAlbum(null);
    router.refresh();
  }

  async function handleDelete(album: AlbumItem) {
    const ok = await confirm(`¿Eliminar el álbum "${album.name}"? Solo se elimina el álbum, no las fotos.`, {
      title: 'Eliminar álbum',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/smart-albums/${album.id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes}
        totalPhotos={totalPhotos}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        catalogs={catalogs}
        activeCatalogId={activeCatalogId}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <main className="main" style={{ padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
              style={{ display: 'none' }}
            >
              <IconMenu size={20} />
            </button>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Álbumes inteligentes</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-small"
              style={{ background: 'var(--border)', color: 'var(--text)' }}
              onClick={() => router.push(`/catalogs/${activeCatalogId}/organize`)}
            >
              Organizar con smart albums
            </button>
            <button
              className="btn-small"
              onClick={() => setShowBuilder(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <IconPlus size={13} />
              Nuevo álbum
            </button>
          </div>
        </div>

        {(isUnstructured || alreadyOrganized) && (
          <UnstructuredCatalogBanner
            catalogId={activeCatalogId}
            catalogName={catalogName}
            alreadyOrganized={alreadyOrganized}
          />
        )}

        {initialAlbums.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '64px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <IconSmartAlbum size={48} />
            <p style={{ margin: 0, fontSize: 15 }}>No hay álbumes inteligentes todavía</p>
            <button className="btn-small" onClick={() => setShowBuilder(true)}>
              Crear el primero
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <select
                className="tag-input"
                style={{ fontSize: 12, padding: '4px 8px' }}
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
              >
                <option value="date_desc">Más recientes primero</option>
                <option value="date_asc">Más antiguos primero</option>
                <option value="name_asc">Nombre A–Z</option>
                <option value="photos_desc">Más fotos primero</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {sortAlbums(initialAlbums, sortKey).map(album => (
                <div
                  key={album.id}
                  style={{
                    background: 'var(--surface)', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column', cursor: 'pointer',
                  }}
                  onClick={() => router.push(`/smart-albums/${album.id}`)}
                >
                  <div style={{
                    height: 140, background: 'var(--bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', position: 'relative',
                  }}>
                    {album.cover_photo_id ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/photos/${album.cover_photo_id}/thumbnail?size=300`}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <IconSmartAlbum size={40} />
                    )}
                  </div>
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, flex: 1 }}>
                        {album.name}
                      </span>
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        <button
                          onClick={e => { e.stopPropagation(); setEditingAlbum(album); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 3, borderRadius: 4 }}
                          title="Editar reglas"
                        >
                          <IconEdit size={13} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(album); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 3, borderRadius: 4 }}
                          title="Eliminar álbum"
                        >
                          <IconTrash size={13} />
                        </button>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                      {describeRules(album.rules)}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                      {album.photo_count.toLocaleString('es')} fotos
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {showBuilder && (
        <SmartAlbumBuilder
          themes={themes}
          onSave={handleCreate}
          onClose={() => setShowBuilder(false)}
        />
      )}
      {editingAlbum && (
        <SmartAlbumBuilder
          initialName={editingAlbum.name}
          initialRules={(() => { try { return JSON.parse(editingAlbum.rules); } catch { return []; } })()}
          themes={themes}
          onSave={handleEdit}
          onClose={() => setEditingAlbum(null)}
        />
      )}
    </div>
  );
}
