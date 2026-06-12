'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { EventGroup } from '@/lib/types';

const PAGE_SIZE = 48;

interface FolderGridProps {
  groups: EventGroup[];
  showYear: boolean;
}

export default function FolderGrid({ groups, showYear }: FolderGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(() => {
    if (visible < groups.length) setVisible(v => v + PAGE_SIZE);
  }, [visible, groups.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore();
    }, { rootMargin: '300px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  function openFolder(group: EventGroup) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', String(group.year));
    params.set('event', group.event);
    router.push(`/library?${params.toString()}`);
  }

  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.3 }}>
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        <p>No hay carpetas.</p>
      </div>
    );
  }

  const shown = groups.slice(0, visible);
  const remaining = groups.length - visible;

  return (
    <>
      <div className="folder-grid">
        {shown.map((group) => (
          <div
            key={`${group.year}-${group.event}`}
            className="folder-card"
            onClick={() => openFolder(group)}
            title={`Abrir "${group.event}"`}
          >
            <div className="folder-card-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photos/${group.thumbnail_id}/thumbnail?size=200`}
                alt={group.event}
                loading="lazy"
                decoding="async"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="folder-card-info">
              {showYear && <span className="folder-card-year">{group.year}</span>}
              <span className="folder-card-name">{group.event}</span>
              <span className="folder-card-count">{group.count} fotos</span>
            </div>
          </div>
        ))}
      </div>
      {remaining > 0 && <div ref={sentinelRef} style={{ height: 1 }} />}
    </>
  );
}
