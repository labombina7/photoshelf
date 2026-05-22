'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
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
}

export default function TagsClient({ tags, themes, projects, totalPhotos, favoriteCount, untaggedCount }: Props) {
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
      />

      <div className="main">
        <div className="topbar">
          <button className="hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
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
            <div className="empty-state">
              <p>No hay tags todavía. Clasifica algunas fotos para empezar.</p>
            </div>
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
