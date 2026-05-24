'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import EmptyState from '@/components/EmptyState';
import { IconMenu } from '@/components/Icons';
import type { Theme } from '@/lib/types';

interface Tag {
  name: string;
  count: number;
}

interface Props {
  tags: Tag[];
  themes: Theme[];
  projects: { id: number; title: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs?: import('@/lib/queries/catalogs').CatalogRow[];
  activeCatalogId?: number;
}

export default function TagsClient({ tags, themes, projects, totalPhotos, favoriteCount, untaggedCount, catalogs = [], activeCatalogId = 1 }: Props) {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : tags;

  // Three size tiers based on count
  const maxCount = tags[0]?.count ?? 1;
  function tier(count: number): 'lg' | 'md' | 'sm' {
    const ratio = count / maxCount;
    if (ratio >= 0.4) return 'lg';
    if (ratio >= 0.15) return 'md';
    return 'sm';
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
        catalogs={catalogs}
        activeCatalogId={activeCatalogId}
      />

      <div className="main">
        <div className="topbar">
          <button className="hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú" aria-label="Abrir menú de navegación">
            <IconMenu size={20} />
          </button>
          <div className="topbar-title">Tags</div>
          <span className="topbar-sub">{tags.length} tags</span>
          <div className="topbar-spacer" />
          <div className="search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              placeholder="Filtrar tags…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="content">
          {filtered.length === 0 ? (
            tags.length === 0 ? (
              <EmptyState
                icon={
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="2.5" />
                  </svg>
                }
                title="Aún no hay etiquetas"
                subtitle="Los tags se generan automáticamente al clasificar fotos con IA, o puedes añadirlos manualmente desde el detalle de cada foto."
                action={{ label: 'Ir a la biblioteca', href: '/library' }}
              />
            ) : (
              <EmptyState
                title={`Sin resultados para "${search}"`}
                subtitle="Prueba con otro término de búsqueda."
                action={{ label: 'Limpiar búsqueda', onClick: () => setSearch('') }}
              />
            )
          ) : (
            <div className="tag-cloud">
              {filtered.map(tag => (
                <button
                  key={tag.name}
                  className={`tag-cloud-chip tag-cloud-chip--${tier(tag.count)}`}
                  onClick={() => router.push(`/tags/${encodeURIComponent(tag.name)}`)}
                >
                  {tag.name}
                  <span className="tag-cloud-count">{tag.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
