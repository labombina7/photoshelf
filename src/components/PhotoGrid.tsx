'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { IconChevronDown, IconChevronUp, IconSparkle } from '@/components/Icons';
import EmptyState from '@/components/EmptyState';
import { useClassify } from '@/components/ClassifyProvider';
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
  tag?: string;
  favorite?: string;
  untagged?: string;
  q?: string;
}

interface PhotoGridProps {
  groups: EventGroup[];
  collapsed: Set<string>;
  onToggle: (key: string) => void;
  activeFilters: ActiveFilters;
  showYear?: boolean;
}

function EventGroupBlock({
  group,
  isCollapsed,
  onToggle,
  activeFilters,
  currentParams,
  showYear,
}: {
  group: EventGroup;
  isCollapsed: boolean;
  onToggle: () => void;
  activeFilters: ActiveFilters;
  currentParams: string;
  showYear: boolean;
}) {
  const PAGE_SIZE = 60;
  const [photos, setPhotos] = useState<PhotoWithTags[] | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const { done: classifyDone, total: classifyTotal } = useClassify();
  const [classifying, setClassifying] = useState(false);
  const [classifyResult, setClassifyResult] = useState<{ processed: number; total: number; errors?: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Infinite scroll: load more photos when sentinel enters viewport
  const loadMore = useCallback(() => {
    if (photos && visible < photos.length) setVisible(v => v + PAGE_SIZE);
  }, [photos, visible]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore();
    }, { rootMargin: '300px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    if (isCollapsed || photos !== null) return;
    setLoading(true);
    setVisible(PAGE_SIZE);
    const params = new URLSearchParams();
    params.set('year', String(group.year));
    params.set('event', group.event);
    if (activeFilters.theme) params.set('theme', activeFilters.theme);
    if (activeFilters.tag) params.set('tag', activeFilters.tag);
    if (activeFilters.favorite) params.set('favorite', activeFilters.favorite);
    if (activeFilters.untagged) params.set('untagged', activeFilters.untagged);
    if (activeFilters.q) params.set('q', activeFilters.q);
    params.set('limit', '2000');

    fetch(`/api/photos?${params.toString()}`)
      .then(r => r.json())
      .then(data => { setPhotos(data.photos); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isCollapsed, photos, group, activeFilters]);

  async function handleClassify(e: React.MouseEvent) {
    e.stopPropagation?.();
    setClassifying(true);
    setClassifyResult(null);
    try {
      const res = await fetch('/api/ai/classify/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: group.year, event: group.event }),
      });
      const data = await res.json();
      setClassifyResult(data);
      setPhotos(null); // reload photos to show new tags
    } finally {
      setClassifying(false);
    }
  }

  return (
    <div className="event-block">
      <div className="event-label" onClick={onToggle} style={{ cursor: 'pointer', userSelect: 'none' }}>
        {showYear && <span className="event-year">{group.year}</span>}
        <span className="event-name">{group.event}</span>
        <span className="event-count">· {group.count} fotos</span>
        {classifyResult && (
          <span style={{ fontSize: 11, color: classifyResult.errors && classifyResult.errors > 0 ? '#b91c1c' : 'var(--text-tertiary)', marginLeft: 4 }}>
            {classifyResult.errors && classifyResult.errors > 0
              ? `⚠ ${classifyResult.processed}/${classifyResult.total} — Ollama no disponible`
              : `✓ ${classifyResult.processed} clasificadas`}
          </span>
        )}
        {classifying && (
          <span className="classify-inline-progress">
            <span className="classify-inline-track">
              {classifyTotal > 0 && classifyDone > 0
                ? <span className="classify-inline-fill" style={{ width: `${Math.round((classifyDone / classifyTotal) * 100)}%` }} />
                : <span className="classify-inline-pulse" />}
            </span>
            {classifyTotal > 0 && classifyDone > 0 && (
              <span className="classify-inline-count">({classifyDone}/{classifyTotal})</span>
            )}
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Desktop: classify button visible inline */}
          <button
            onClick={handleClassify}
            disabled={classifying}
            className="classify-btn classify-btn--desktop"
            title="Clasificar fotos de esta carpeta"
          >
            <IconSparkle size={11} />
            <span>{classifying ? 'Clasificando…' : 'Clasificar'}</span>
          </button>
          {/* Mobile: 3-dots menu */}
          <div ref={menuRef} className="event-menu-wrap event-menu--mobile">
            <button
              className="event-menu-btn"
              title="Más opciones"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
            >
              ···
            </button>
            {menuOpen && (
              <div className="event-menu-dropdown">
                <button
                  className="event-menu-item"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); handleClassify(e); }}
                  disabled={classifying}
                >
                  <IconSparkle size={11} />
                  {classifying ? 'Clasificando…' : 'Clasificar'}
                </button>
              </div>
            )}
          </div>
          {isCollapsed ? <IconChevronDown /> : <IconChevronUp />}
        </span>
      </div>
      {!isCollapsed && (
        <>
          <div className="photo-grid">
            {loading && (
              <div style={{ gridColumn: '1/-1', padding: '20px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                Cargando fotos…
              </div>
            )}
            {photos?.slice(0, visible).map((photo) => {
              const previewTags = photo.tags.slice(0, 2);
              return (
                <Link
                  key={photo.id}
                  href={`/library/${photo.id}${currentParams ? `?${currentParams}` : ''}`}
                  className="photo-item"
                >
                  <div className="photo-skeleton" aria-hidden="true" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/photos/${photo.id}/thumbnail?size=300`}
                    alt={photo.tags.length > 0 ? photo.tags.slice(0, 3).map(t => t.name).join(', ') : photo.filename}
                    loading="lazy"
                    decoding="async"
                    onLoad={(e) => {
                      e.currentTarget.classList.add('loaded');
                      (e.currentTarget.previousElementSibling as HTMLElement).style.display = 'none';
                    }}
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
          {/* Sentinel: triggers infinite scroll when it enters the viewport */}
          {photos && visible < photos.length && (
            <div ref={sentinelRef} style={{ height: 1 }} />
          )}
        </>
      )}
    </div>
  );
}

export default function PhotoGrid({ groups, collapsed, onToggle, activeFilters, showYear = false }: PhotoGridProps) {
  const searchParams = useSearchParams();
  const currentParams = searchParams.toString();

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        }
        title="Tu biblioteca está vacía"
        subtitle="Ejecuta el escáner para indexar las fotos de tu NAS y empezar a explorarlas."
        action={{ label: 'Reescanear biblioteca', href: '/library' }}
      />
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
            showYear={showYear}
          />
        );
      })}
    </>
  );
}
