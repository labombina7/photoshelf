'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { IconMenu } from '@/components/Icons';
import type { Theme } from '@/lib/types';

type Level = 'year' | 'month' | 'day';

interface PhotoRow {
  id: number;
  filename: string;
  taken_at: string | null;
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
  projects: { id: number; title: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
}

const LEVELS: Level[] = ['year', 'month', 'day'];

const VISUAL_ZOOM_CONFIG = [
  { size: 100, limit: 120 },
  { size: 150, limit: 84 },
  { size: 200, limit: 60 },
  { size: 300, limit: 36 },
  { size: 420, limit: 24 },
] as const;

const LEVEL_ZOOM: Record<Level, number> = { year: 1, month: 3, day: 5 };

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
  projects,
  totalPhotos,
  favoriteCount,
  untaggedCount,
}: Props) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [level, setLevel] = useState<Level>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('photoshelf_timeline_level');
      if (stored && LEVELS.includes(stored as Level)) return stored as Level;
    }
    return 'month';
  });
  const visualZoom = LEVEL_ZOOM[level];
  const [allPhotos, setAllPhotos] = useState<PhotoRow[]>(initialRows);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [stickyLabel, setStickyLabel] = useState<string>('');

  const sentinelRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const contentRef = useRef<HTMLDivElement>(null);

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
      const incoming: PhotoRow[] = (data.groups as Group[]).flatMap(g => g.photos);
      setAllPhotos(prev => [...prev, ...incoming]);
      setNextCursor(data.nextCursor ?? null);
      setHasMore(data.hasMore ?? false);
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
    }, { rootMargin: '400px' });
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

  const levelLabel: Record<Level, string> = { year: 'Año', month: 'Mes', day: 'Día' };

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
            <div className="topbar-title">
              {stickyLabel || 'Línea de tiempo'}
            </div>
          </div>

          <div className="topbar-spacer" />

          {/* Temporal zoom controls */}
          <div className="timeline-zoom-controls">
            {LEVELS.map(l => (
              <button
                key={l}
                className={`timeline-level-btn ${level === l ? 'active' : ''}`}
                onClick={() => setLevel(l)}
              >
                {levelLabel[l]}
              </button>
            ))}
          </div>
        </div>

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
              </div>

              <div className={`timeline-grid timeline-grid--z${visualZoom}`}>
                {group.photos.map(photo => (
                  <Link
                    key={photo.id}
                    href={`/library/${photo.id}`}
                    className="photo-item"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/photos/${photo.id}/thumbnail?size=${vzConfig.size}`}
                      alt={photo.filename}
                      loading="lazy"
                      decoding="async"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
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
