'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { IconMenu } from '@/components/Icons';
import { useHeaderSlot } from '@/components/HeaderSlot';
import type { Theme } from '@/lib/types';

type Level = 'year' | 'month' | 'day';

interface PhotoRow {
  id: number;
  filename: string;
  taken_at: string | null;
  tags_preview: string | null;
}

interface Group {
  label: string;
  period: string;
  count: number;
  photos: PhotoRow[];
}

interface Props {
  initialRows: PhotoRow[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  themes: Theme[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs?: import('@/lib/queries/catalogs').CatalogRow[];
  activeCatalogId?: number;
}

const LEVELS: Level[] = ['year', 'month', 'day'];

const LEVEL_LABEL: Record<Level, string> = { year: 'Año', month: 'Mes', day: 'Día' };
const LEVEL_TITLE: Record<Level, string> = { year: 'Agrupar por año', month: 'Agrupar por mes', day: 'Agrupar por día' };

const VISUAL_ZOOM_CONFIG = [
  { size: 100, limit: 120 },
  { size: 150, limit: 84 },
  { size: 200, limit: 60 },
  { size: 300, limit: 36 },
  { size: 420, limit: 24 },
] as const;

const LEVEL_ZOOM: Record<Level, number> = { year: 1, month: 3, day: 4 };

function getPeriodKey(takenAt: string | null, level: Level): string {
  if (!takenAt) return 'nodate';
  const d = new Date(takenAt);
  if (level === 'year') return String(d.getUTCFullYear());
  if (level === 'month') return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return takenAt.slice(0, 10);
}

function formatLabel(period: string, level: Level): string {
  if (period === 'nodate') return 'Sin fecha';
  if (level === 'year') return period;
  if (level === 'month') {
    const [y, m] = period.split('-');
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }
  const [y, m, d] = period.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupPhotos(photos: PhotoRow[], level: Level): Group[] {
  const groupMap = new Map<string, Group>();
  const groupOrder: string[] = [];

  for (const row of photos) {
    const period = getPeriodKey(row.taken_at, level);
    if (!groupMap.has(period)) {
      groupMap.set(period, { label: formatLabel(period, level), period, count: 0, photos: [] });
      groupOrder.push(period);
    }
    const g = groupMap.get(period)!;
    g.photos.push(row);
    g.count++;
  }

  return groupOrder
    .filter(p => p !== 'nodate')
    .concat(groupOrder.includes('nodate') ? ['nodate'] : [])
    .map(p => groupMap.get(p)!);
}

export default function TimelineClient({
  initialRows,
  initialNextCursor,
  initialHasMore,
  themes,
  totalPhotos,
  favoriteCount,
  untaggedCount,
  catalogs = [],
  activeCatalogId = 1,
}: Props) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [level, setLevel] = useState<Level>('month');
  const visualZoom = LEVEL_ZOOM[level];
  const [allPhotos, setAllPhotos] = useState<PhotoRow[]>(initialRows);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [stickyLabel, setStickyLabel] = useState<string>('');

  const sentinelRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const contentRef = useRef<HTMLDivElement>(null);

  // Restore level from sessionStorage after hydration (avoids SSR/client mismatch)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('photoshelf_timeline_level');
      if (stored && LEVELS.includes(stored as Level)) setLevel(stored as Level);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist level choices
  useEffect(() => {
    try { sessionStorage.setItem('photoshelf_timeline_level', level); } catch {}
  }, [level]);

  const vzConfig = VISUAL_ZOOM_CONFIG[visualZoom - 1];

  const groups = useMemo(() => groupPhotos(allPhotos, level), [allPhotos, level]);

  // Set initial sticky label
  useEffect(() => {
    if (groups.length > 0) setStickyLabel(groups[0].label);
  }, [groups]);

  // Fetch more photos
  const fetchMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const limit = VISUAL_ZOOM_CONFIG[visualZoom - 1].limit;
      const params = new URLSearchParams({ level, limit: String(limit) });
      if (nextCursor) params.set('cursor', nextCursor);
      const res = await fetch(`/api/timeline?${params}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.groups)) {
        console.error('[Timeline] fetchMore: unexpected response', data);
        return;
      }
      const incoming: PhotoRow[] = (data.groups as Group[]).flatMap(g => g.photos);
      setAllPhotos(prev => [...prev, ...incoming]);
      setNextCursor(data.nextCursor ?? null);
      setHasMore(data.hasMore ?? false);
      // Prefetch thumbnails del primer grupo de la nueva página
      const currentVzConfig = VISUAL_ZOOM_CONFIG[visualZoom - 1];
      const nextGroupPhotos = incoming.slice(0, Math.ceil(currentVzConfig.limit / 3));
      nextGroupPhotos.forEach(photo => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'image';
        link.href = `/api/photos/${photo.id}/thumbnail?size=${currentVzConfig.size}`;
        document.head.appendChild(link);
      });
    } catch (err) {
      console.error('[Timeline] fetchMore error:', err instanceof Error ? err.message : err);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, level, nextCursor]);

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) fetchMore();
    }, { rootMargin: '800px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchMore]);

  // Sticky header: IntersectionObserver on first photo of each group
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const content = contentRef.current;
    if (!content) return;

    // Track which groups are currently "above the fold" (period header has scrolled past)
    const visible = new Set<string>();

    groups.forEach((group) => {
      const el = groupRefs.current.get(group.period);
      if (!el) return;

      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            visible.add(group.period);
          } else {
            // If scrolled past (above), keep label as this group
            if (entry.boundingClientRect.top < 0) {
              visible.add(group.period);
            } else {
              visible.delete(group.period);
            }
          }
          // The topmost visible (or just-past) group
          const topGroup = groups.find(g => visible.has(g.period));
          if (topGroup) setStickyLabel(topGroup.label);
          else if (groups.length > 0) setStickyLabel(groups[0].label);
        },
        { root: content, rootMargin: '-60px 0px 0px 0px', threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, [groups]);

  // Ctrl+Wheel to change zoom level
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setLevel(prev => {
        const idx = LEVELS.indexOf(prev);
        if (e.deltaY < 0) return LEVELS[Math.max(0, idx - 1)];
        return LEVELS[Math.min(LEVELS.length - 1, idx + 1)];
      });
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // +/- keys to change temporal level
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setLevel(prev => LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(prev) + 1)]);
      } else if (e.key === '-') {
        e.preventDefault();
        setLevel(prev => LEVELS[Math.max(0, LEVELS.indexOf(prev) - 1)]);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Double-tap on mobile to toggle between month and day
  useEffect(() => {
    let lastTap = 0;
    const handleTouchEnd = () => {
      const now = Date.now();
      if (now - lastTap < 300) {
        setLevel(prev => prev === 'day' ? 'month' : 'day');
      }
      lastTap = now;
    };
    const content = contentRef.current;
    if (!content) return;
    content.addEventListener('touchend', handleTouchEnd);
    return () => content.removeEventListener('touchend', handleTouchEnd);
  }, []);

  // Inject controls into the global app-header (matches library page pattern).
  // useMemo stabilises the JSX reference: useHeaderSlot's effect only re-fires
  // when stickyLabel or level actually change, avoiding a render cascade.
  const headerSlotContent = useMemo(() => (
    <div className="header-slot-timeline">
      <button
        className="hamburger header-slot-hamburger"
        onClick={() => setMobileSidebarOpen(true)}
        title="Menú"
      >
        <IconMenu size={20} />
      </button>
      <div className="timeline-zoom-controls">
        {LEVELS.map(l => (
          <button
            key={l}
            className={`timeline-level-btn ${level === l ? 'active' : ''}`}
            onClick={() => setLevel(l)}
            title={LEVEL_TITLE[l]}
          >
            {LEVEL_LABEL[l]}
          </button>
        ))}
      </div>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [stickyLabel, level]);
  useHeaderSlot(headerSlotContent);

  const priorityCount = vzConfig.limit / 3;

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes}
        totalPhotos={totalPhotos}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        catalogs={catalogs}
        activeCatalogId={activeCatalogId}
      />

      <div className="main">
        <div className="content timeline-content" ref={contentRef}>
          {groups.map(group => (
            <div key={group.period} className="timeline-group">
              {/* Period header — anchored for IntersectionObserver */}
              <div
                className="timeline-period-header"
                ref={el => {
                  if (el) groupRefs.current.set(group.period, el);
                  else groupRefs.current.delete(group.period);
                }}
              >
                <span className="timeline-period-label">{group.label}</span>
                {level === 'year' && group.period !== 'nodate' && (
                  <span className="timeline-period-count">{group.count.toLocaleString('es')} fotos</span>
                )}
                {group.period !== 'nodate' && (
                  <Link
                    href={`/library?year=${group.period.split('-')[0]}`}
                    className="timeline-library-link"
                  >
                    Ver en biblioteca →
                  </Link>
                )}
              </div>

              <div className={`timeline-grid timeline-grid--z${visualZoom}`}>
                {group.photos.map(photo => (
                  <Link
                    key={photo.id}
                    href={`/library/${photo.id}`}
                    className="photo-item"
                    onClick={() => {
                      try {
                        sessionStorage.setItem('photoshelf_detail_origin', JSON.stringify({
                          href: window.location.pathname + window.location.search,
                          label: 'Timeline',
                        }));
                      } catch {}
                    }}
                  >
                    <div className="photo-item-wrapper">
                      <div className="photo-skeleton" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/photos/${photo.id}/thumbnail?size=${vzConfig.size}`}
                        alt={photo.tags_preview ?? photo.filename}
                        loading="lazy"
                        decoding="async"
                        fetchPriority={allPhotos.indexOf(photo) < priorityCount ? 'high' : 'auto'}
                        onLoad={e => { e.currentTarget.classList.add('loaded'); (e.currentTarget.previousElementSibling as HTMLElement).style.display = 'none'; }}
                        onError={e => {
                          const img = e.currentTarget;
                          img.style.display = 'none';
                          const broken = document.createElement('div');
                          broken.className = 'photo-broken';
                          broken.textContent = '🖼';
                          img.parentElement?.appendChild(broken);
                        }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

          {loading && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
              Cargando…
            </div>
          )}

          {!hasMore && allPhotos.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 14 }}>
              No hay fotos en la biblioteca
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
