'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import PhotoGrid from '@/components/PhotoGrid';
import { IconEdit, IconMenu } from '@/components/Icons';
import SmartAlbumBuilder from '../SmartAlbumBuilder';
import type { Theme } from '@/lib/types';
import type { CatalogRow } from '@/lib/queries/catalogs';
import type { AlbumRule } from '@/lib/smartAlbumQuery';

interface EventGroup {
  year: number;
  event: string;
  count: number;
  thumbnail_id: number;
}

interface AlbumData {
  id: number;
  name: string;
  rules: string;
  created_at: string;
}

interface SmartAlbumDetailClientProps {
  album: AlbumData;
  groups: EventGroup[];
  total: number;
  themes: Theme[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  projects: { id: number; title: string }[];
  smartAlbums: { id: number; name: string }[];
  catalogs: CatalogRow[];
  activeCatalogId: number;
}

export default function SmartAlbumDetailClient({
  album,
  groups,
  total,
  themes,
  totalPhotos,
  favoriteCount,
  untaggedCount,
  projects,
  smartAlbums,
  catalogs,
  activeCatalogId,
}: SmartAlbumDetailClientProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showBuilder, setShowBuilder] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleToggle(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave(name: string, rules: AlbumRule[]) {
    await fetch(`/api/smart-albums/${album.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rules }),
    });
    setShowBuilder(false);
    router.refresh();
  }

  const initialRules: AlbumRule[] = (() => {
    try { return JSON.parse(album.rules); } catch { return []; }
  })();

  return (
    <>
      <Sidebar
        themes={themes}
        projects={projects}
        smartAlbums={smartAlbums}
        totalPhotos={totalPhotos}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        catalogs={catalogs}
        activeCatalogId={activeCatalogId}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="main">
        <div className="content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
              style={{ display: 'none' }}
            >
              <IconMenu size={20} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link href="/smart-albums" style={{ color: 'var(--text-tertiary)', fontSize: 13, textDecoration: 'none' }}>
                  Álbumes
                </Link>
                <span style={{ color: 'var(--text-tertiary)' }}>/</span>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {album.name}
                </h1>
                <button
                  onClick={() => setShowBuilder(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                  title="Editar reglas"
                >
                  <IconEdit size={14} />
                </button>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                {total.toLocaleString('es')} fotos
              </p>
            </div>
          </div>

          <PhotoGrid
            groups={groups}
            collapsed={collapsed}
            onToggle={handleToggle}
            activeFilters={{}}
          />
        </div>
      </div>

      {showBuilder && (
        <SmartAlbumBuilder
          initialName={album.name}
          initialRules={initialRules}
          themes={themes}
          onSave={handleSave}
          onClose={() => setShowBuilder(false)}
        />
      )}
    </>
  );
}
