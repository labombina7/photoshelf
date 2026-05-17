'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { IconChevronDown, IconChevronUp } from '@/components/Icons';
import type { Photo, Tag } from '@/lib/types';

interface PhotoWithTags extends Photo {
  tags: Tag[];
}

interface EventGroup {
  year: number;
  event: string;
  count: number;
}

interface ActiveFilters {
  year?: string;
  theme?: string;
  favorite?: string;
  untagged?: string;
  q?: string;
}

interface PhotoGridProps {
  groups: EventGroup[];
  collapsed: Set<string>;
  onToggle: (key: string) => void;
  activeFilters: ActiveFilters;
}

function EventGroupBlock({
  group,
  isCollapsed,
  onToggle,
  activeFilters,
  currentParams,
}: {
  group: EventGroup;
  isCollapsed: boolean;
  onToggle: () => void;
  activeFilters: ActiveFilters;
  currentParams: string;
}) {
  const [photos, setPhotos] = useState<PhotoWithTags[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isCollapsed || photos !== null) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set('year', String(group.year));
    params.set('event', group.event);
    if (activeFilters.theme) params.set('theme', activeFilters.theme);
    if (activeFilters.favorite) params.set('favorite', activeFilters.favorite);
    if (activeFilters.untagged) params.set('untagged', activeFilters.untagged);
    if (activeFilters.q) params.set('q', activeFilters.q);
    params.set('limit', '2000');

    fetch(`/api/photos?${params.toString()}`)
      .then(r => r.json())
      .then(data => { setPhotos(data.photos); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isCollapsed, photos, group, activeFilters]);

  const key = `${group.year}-${group.event}`;

  return (
    <div className="event-block">
      <div className="event-label" onClick={onToggle} style={{ cursor: 'pointer', userSelect: 'none' }}>
        <span className="event-name">{group.event}</span>
        <span className="event-count">· {group.count} fotos</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
          {isCollapsed ? <IconChevronDown /> : <IconChevronUp />}
        </span>
      </div>
      {!isCollapsed && (
        <div className="photo-grid">
          {loading && (
            <div style={{ gridColumn: '1/-1', padding: '20px', color: 'var(--text-tertiary)', fontSize: 13 }}>
              Cargando fotos…
            </div>
          )}
          {photos?.map((photo) => {
            const previewTags = photo.tags.slice(0, 2);
            return (
              <Link
                key={photo.id}
                href={`/library/${photo.id}${currentParams ? `?${currentParams}` : ''}`}
                className="photo-item"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${photo.id}/thumbnail`}
                  alt={photo.filename}
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {previewTags.length > 0 && (
                  <div className="photo-overlay">
                    {previewTags.map((tag) => (
                      <span key={tag.name} className={`photo-tag-chip ${tag.source === 'ai' ? 'auto' : ''}`}>
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PhotoGrid({ groups, collapsed, onToggle, activeFilters }: PhotoGridProps) {
  const searchParams = useSearchParams();
  const currentParams = searchParams.toString();

  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.3 }}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <p>No hay fotos. Haz clic en &ldquo;Reescanear biblioteca&rdquo; para comenzar.</p>
      </div>
    );
  }

  return (
    <>
      {groups.map((group) => {
        const key = `${group.year}-${group.event}`;
        return (
          <EventGroupBlock
            key={key}
            group={group}
            isCollapsed={collapsed.has(key)}
            onToggle={() => onToggle(key)}
            activeFilters={activeFilters}
            currentParams={currentParams}
          />
        );
      })}
    </>
  );
}
