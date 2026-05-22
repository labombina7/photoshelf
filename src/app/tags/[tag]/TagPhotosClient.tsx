'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PhotoGrid from '@/components/PhotoGrid';
import { IconMenu } from '@/components/Icons';
import type { Theme } from '@/lib/types';

interface EventGroup {
  year: number;
  event: string;
  count: number;
  thumbnail_id: number;
}

interface Props {
  tagName: string;
  groups: EventGroup[];
  total: number;
  themes: Theme[];
  projects: { id: number; title: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
}

export default function TagPhotosClient({ tagName, groups, total, themes, projects, totalPhotos, favoriteCount, untaggedCount }: Props) {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const allGroupKeys = useMemo(() => groups.map(g => `${g.year}-${g.event}`), [groups]);
  // Start all collapsed; user expands individually
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(allGroupKeys));

  function toggleGroup(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const allCollapsed = collapsed.size === allGroupKeys.length;
  function collapseAll() { setCollapsed(new Set(allGroupKeys)); }
  function expandAll() { setCollapsed(new Set()); }

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
      />

      <div className="main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
              <IconMenu size={20} />
            </button>
            <button className="back-btn" onClick={() => router.push('/tags')} title="Volver a tags">
              ←
            </button>
            <div className="topbar-title">{tagName}</div>
          </div>
          <span className="topbar-sub">{total.toLocaleString('es')} fotos</span>
          <div className="topbar-spacer" />
        </div>

        <div className="content">
          {groups.length > 1 && (
            <div className="collapse-controls">
              <button className="collapse-btn" onClick={allCollapsed ? expandAll : collapseAll}>
                {allCollapsed ? 'Expandir todo' : 'Colapsar todo'}
              </button>
            </div>
          )}
          <PhotoGrid
            groups={groups}
            collapsed={collapsed}
            onToggle={toggleGroup}
            activeFilters={{ tag: tagName }}
            showYear
          />
        </div>
      </div>
    </div>
  );
}
