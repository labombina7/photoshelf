'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconChevronDown, IconChevronUp, IconSparkle } from '@/components/Icons';
import EmptyState from '@/components/EmptyState';
import { useClassify } from '@/components/ClassifyProvider';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { Photo, Tag } from '@/lib/types';

function IconStar({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={className}
      width="16" height="16" viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

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
  iso_max?: string;
  aperture_max?: string;
  focal_min?: string;
  focal_max?: string;
  camera?: string;
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
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoWithTags[] | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const { done: classifyDone, total: classifyTotal } = useClassify();
  const { track } = useAnalytics();
  const [classifying, setClassifying] = useState(false);
  const [classifyResult, setClassifyResult] = useState<{ processed: number; total: number; errors?: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  // true when the device has a precise pointer (mouse/trackpad) → selection mode
  const isPointerFine = useRef(false);
  useEffect(() => {
    isPointerFine.current = window.matchMedia('(pointer: fine)').matches;
  }, []);

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

  // Reset photos when the URL params change (e.g. EXIF filters applied)
  const prevParamsRef = useRef(currentParams);
  useEffect(() => {
    if (prevParamsRef.current !== currentParams) {
      prevParamsRef.current = currentParams;
      setPhotos(null);
    }
  }, [currentParams]);

  useEffect(() => {
    if (isCollapsed || photos !== null) return;
    setLoading(true);
    setVisible(PAGE_SIZE);
    // Use currentParams as base so EXIF and other URL filters are included,
    // then override with the specific group's year/event and set a high limit.
    const params = new URLSearchParams(currentParams);
    params.set('year', String(group.year));
    params.set('event', group.event);
    params.set('limit', '2000');

    fetch(`/api/photos?${params.toString()}`)
      .then(r => r.json())
      .then(data => { setPhotos(data.photos); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isCollapsed, photos, group, currentParams]);

  // ── Navegación al detalle ────────────────────────────────────────────────

  function navigateTo(photoId: number) {
    track('photo_opened', { photo_id: photoId, source: 'grid' });
    try {
      sessionStorage.setItem('photoshelf_detail_origin', JSON.stringify({
        href: window.location.pathname + window.location.search,
        label: 'Biblioteca',
      }));
    } catch {}
    router.push(`/library/${photoId}${currentParams ? `?${currentParams}` : ''}`);
  }

  // ── Keyboard navigation ──────────────────────────────────────────────────

  function getGridCols(): number {
    if (!gridRef.current) return 1;
    const cols = getComputedStyle(gridRef.current).gridTemplateColumns.split(' ').length;
    return Math.max(1, cols);
  }

  function handleGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const visiblePhotos = photos?.slice(0, visible) ?? [];
    if (visiblePhotos.length === 0) return;

    // Only act on navigation/favorite keys
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'f', 'F', 'Enter', 'Escape'].includes(e.key)) return;

    // Don't hijack if focus is on an input or interactive element inside the grid
    const tag = (e.target as HTMLElement).tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(tag) && e.key !== ' ' && e.key !== 'f' && e.key !== 'F') return;

    e.preventDefault();

    const current = focusedIndex ?? -1;
    const cols = getGridCols();
    const total = visiblePhotos.length;

    if (e.key === 'ArrowRight') {
      setFocusedIndex(Math.min(current + 1, total - 1) < 0 ? 0 : Math.min(current + 1, total - 1));
    } else if (e.key === 'ArrowLeft') {
      setFocusedIndex(current <= 0 ? 0 : current - 1);
    } else if (e.key === 'ArrowDown') {
      const next = current + cols;
      setFocusedIndex(next >= total ? current : next < 0 ? 0 : next);
    } else if (e.key === 'ArrowUp') {
      const prev = current - cols;
      setFocusedIndex(prev < 0 ? (current < 0 ? 0 : current) : prev);
    } else if (e.key === ' ' || e.key === 'f' || e.key === 'F') {
      const idx = current < 0 ? 0 : current;
      const photo = visiblePhotos[idx];
      if (photo) toggleFavorite(photo.id, idx);
    } else if (e.key === 'Enter') {
      const photo = visiblePhotos[current < 0 ? 0 : current];
      if (photo) navigateTo(photo.id);
    } else if (e.key === 'Escape') {
      setFocusedIndex(null);
    }
  }

  // Scroll focused photo into view
  useEffect(() => {
    if (focusedIndex === null || !gridRef.current) return;
    const items = gridRef.current.querySelectorAll<HTMLElement>('.photo-item');
    items[focusedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedIndex]);

  // ── Toggle favorito ──────────────────────────────────────────────────────

  async function toggleFavorite(photoId: number, visibleIdx: number) {
    if (!photos) return;

    // Find photo in full photos array by id (not just visible slice)
    const fullIdx = photos.findIndex(p => p.id === photoId);
    if (fullIdx === -1) return;

    const current = photos[fullIdx].is_favorite;
    const newValue = current ? 0 : 1;

    track('photo_favorited', { photo_id: photoId, action: newValue ? 'add' : 'remove' });

    // Optimistic update
    setPhotos(prev => {
      if (!prev) return prev;
      const updated = [...prev];
      updated[fullIdx] = { ...updated[fullIdx], is_favorite: newValue };
      return updated;
    });

    try {
      const res = await fetch(`/api/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: !!newValue }),
      });
      if (!res.ok) throw new Error('API error');
    } catch {
      // Revert on error
      setPhotos(prev => {
        if (!prev) return prev;
        const reverted = [...prev];
        reverted[fullIdx] = { ...reverted[fullIdx], is_favorite: current };
        return reverted;
      });
    }

    // Keep focus on the toggled item (it might have shifted if filtering)
    setFocusedIndex(visibleIdx);
  }

  async function handleClassify(e: React.MouseEvent) {
    e.stopPropagation?.();
    track('ai_classify_triggered');
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
          <div
            ref={gridRef}
            className="photo-grid"
            tabIndex={0}
            onKeyDown={handleGridKeyDown}
            onBlur={() => setFocusedIndex(null)}
            style={{ outline: 'none' }}
          >
            {loading && (
              <div style={{ gridColumn: '1/-1', padding: '20px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                Cargando fotos…
              </div>
            )}
            {photos?.slice(0, visible).map((photo, idx) => {
              const previewTags = photo.tags.slice(0, 2);
              const isFocused = focusedIndex === idx;
              const isFav = !!photo.is_favorite;
              return (
                <div
                  key={photo.id}
                  className={`photo-item${isFocused ? ' photo-item--focused' : ''}`}
                  role="button"
                  tabIndex={-1}
                  onMouseEnter={() => { if (isPointerFine.current) setFocusedIndex(idx); }}
                  onClick={() => navigateTo(photo.id)}
                >
                  <div className="photo-skeleton" aria-hidden="true" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/photos/${photo.id}/thumbnail?size=200`}
                    alt={photo.tags.length > 0 ? photo.tags.slice(0, 3).map(t => t.name).join(', ') : photo.filename}
                    loading="lazy"
                    decoding="async"
                    onLoad={(e) => {
                      e.currentTarget.classList.add('loaded');
                      (e.currentTarget.previousElementSibling as HTMLElement).style.display = 'none';
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  {/* Star icon */}
                  <button
                    className={`photo-star${isFav ? ' photo-star--active' : ''}`}
                    aria-label={isFav ? 'Quitar de favoritas' : 'Marcar como favorita'}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleFavorite(photo.id, idx);
                    }}
                  >
                    <IconStar filled={isFav} />
                  </button>
                  {previewTags.length > 0 && (
                    <div className="photo-overlay">
                      {previewTags.map((tag) => (
                        <span key={tag.name} className={`photo-tag-chip ${tag.source === 'ai' ? 'auto' : ''}`}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
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
