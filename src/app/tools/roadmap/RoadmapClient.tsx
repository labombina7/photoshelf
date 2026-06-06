'use client';

import { useState, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import { useHeaderSlot } from '@/components/HeaderSlot';
import { IconMenu, IconCalendar } from '@/components/Icons';
import type { ThemeWithCount } from '@/lib/queries/themes';
import type { CatalogRow } from '@/lib/queries/catalogs';

interface Props {
  themes: ThemeWithCount[];
  projects: { id: number; title: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs?: CatalogRow[];
  activeCatalogId?: number;
}

export default function RoadmapClient({
  themes, projects, totalPhotos, favoriteCount, untaggedCount, catalogs, activeCatalogId,
}: Props) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useHeaderSlot(useMemo(() => (
    <div className="header-slot-library">
      <button className="hamburger header-slot-hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
        <IconMenu size={20} />
      </button>
      <span className="header-slot-title">Roadmap</span>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), []));

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

      <div className="main" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        <iframe
          src="/specs/kanban.html"
          title="Roadmap — Photoshelf Kanban"
          style={{
            flex: 1,
            width: '100%',
            border: 'none',
            minHeight: 'calc(100vh - var(--header-h))',
          }}
        />
      </div>
    </div>
  );
}
