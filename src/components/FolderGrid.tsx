'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconSparkle } from '@/components/Icons';

const PAGE_SIZE = 48;

interface EventGroup {
  year: number;
  event: string;
  count: number;
  thumbnail_id: number;
}

interface FolderGridProps {
  groups: EventGroup[];
  showYear: boolean;
}

function FolderCard({ group, showYear, onOpen }: { group: EventGroup; showYear: boolean; onOpen: () => void }) {
  const [classifying, setClassifying] = useState(false);
  const [classified, setClassified] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  async function handleClassify(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    setClassifying(true);
    try {
      await fetch('/api/ai/classify/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: group.year, event: group.event }),
      });
      setClassified(true);
    } finally {
      setClassifying(false);
    }
  }

  return (
    <div
      className="folder-card"
      onDoubleClick={onOpen}
      title={`Doble clic para abrir "${group.event}"`}
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
        <div className="folder-card-meta">
          {showYear && <span className="folder-card-year">{group.year}</span>}
          <span className="folder-card-name">{group.event}</span>
          <span className="folder-card-count">{group.count} fotos{classified ? ' · ✓' : ''}</span>
        </div>
        <div className="folder-card-actions">
          {/* Desktop: classify button inline */}
          <button
            className="classify-btn classify-btn--desktop"
            onClick={handleClassify}
            disabled={classifying}
            title="Clasificar con IA"
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
                  onClick={handleClassify}
                  disabled={classifying}
                >
                  <IconSparkle size={11} />
                  {classifying ? 'Clasificando…' : 'Clasificar con IA'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
          <FolderCard
            key={`${group.year}-${group.event}`}
            group={group}
            showYear={showYear}
            onOpen={() => openFolder(group)}
          />
        ))}
      </div>
      {remaining > 0 && <div ref={sentinelRef} style={{ height: 1 }} />}
    </>
  );
}
