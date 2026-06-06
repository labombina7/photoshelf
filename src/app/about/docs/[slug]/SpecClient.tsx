'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useHeaderSlot } from '@/components/HeaderSlot';
import { IconMenu } from '@/components/Icons';
import type { ThemeWithCount } from '@/lib/queries/themes';
import type { CatalogRow } from '@/lib/queries/catalogs';

interface Props {
  slug: string;
  html: string;
  status: 'todo' | 'done';
  themes: ThemeWithCount[];
  projects: { id: number; title: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs?: CatalogRow[];
  activeCatalogId?: number;
}

export default function SpecClient({
  slug, html, status,
  themes, projects, totalPhotos, favoriteCount, untaggedCount, catalogs, activeCatalogId,
}: Props) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const id = slug.split('-').slice(0, 2).join('-').toUpperCase();

  useHeaderSlot(useMemo(() => (
    <div className="header-slot-library">
      <button className="hamburger header-slot-hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
        <IconMenu size={20} />
      </button>
      <span className="header-slot-title">{id}</span>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [id]));

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes} projects={projects} totalPhotos={totalPhotos}
        favoriteCount={favoriteCount} untaggedCount={untaggedCount}
        mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)}
        catalogs={catalogs} activeCatalogId={activeCatalogId}
      />

      <div className="main">
        <div className="content" style={{ maxWidth: 720 }}>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <Link href="/about" style={{ color: 'var(--text-tertiary)', fontSize: 12, textDecoration: 'none' }}>
              Acerca de
            </Link>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>/</span>
            <Link href="/about/docs" style={{ color: 'var(--text-tertiary)', fontSize: 12, textDecoration: 'none' }}>
              Documentación
            </Link>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>/</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{id}</span>
            <span style={{
              marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 7px',
              borderRadius: 10, flexShrink: 0,
              background: status === 'done' ? '#dcfce7' : '#eff6ff',
              color: status === 'done' ? '#166534' : '#1d4ed8',
            }}>
              {status === 'done' ? '✓ completado' : 'pendiente'}
            </span>
          </div>

          {/* Markdown content */}
          <div
            className="spec-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />

        </div>
      </div>
    </div>
  );
}
