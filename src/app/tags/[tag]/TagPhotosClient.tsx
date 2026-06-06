'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { IconMenu } from '@/components/Icons';
import { useHeaderSlot } from '@/components/HeaderSlot';
import type { Theme } from '@/lib/types';

const PAGE_SIZE = 60;

interface Photo {
  id: number;
  filename: string;
  tags: { name: string; source: string }[];
}

interface Props {
  tagName: string;
  total: number;
  themes: Theme[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs?: import('@/lib/queries/catalogs').CatalogRow[];
  activeCatalogId?: number;
}

export default function TagPhotosClient({ tagName, total, themes, totalPhotos, favoriteCount, untaggedCount, catalogs = [], activeCatalogId = 1 }: Props) {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tag: tagName, limit: String(PAGE_SIZE), page: String(p) });
      const res = await fetch(`/api/photos?${params}`);
      const data = await res.json();
      const incoming: Photo[] = data.photos ?? [];
      setPhotos(prev => p === 1 ? incoming : [...prev, ...incoming]);
      setHasMore(incoming.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [tagName]);

  // Load first page on mount
  useEffect(() => { fetchPage(1); }, [fetchPage]);

  // Infinite scroll
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  }, [hasMore, loading, page, fetchPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore();
    }, { rootMargin: '300px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  useHeaderSlot(useMemo(() => (
    <div className="header-slot-library">
      <button className="hamburger header-slot-hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
        <IconMenu size={20} />
      </button>
      <button className="back-btn" onClick={() => router.push('/tags')} title="Volver a tags">←</button>
      <span className="header-slot-title">{tagName}</span>
      <span className="header-slot-sub">{total.toLocaleString('es')} fotos</span>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [tagName, total]));

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
        <div className="content">
          {photos.length === 0 && loading && (
            <div style={{ padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>Cargando fotos…</div>
          )}

          <div className="photo-grid">
            {photos.map(photo => {
              const previewTags = photo.tags.slice(0, 2);
              return (
                <Link
                  key={photo.id}
                  href={`/library/${photo.id}?back=${encodeURIComponent('/tags/' + encodeURIComponent(tagName))}`}
                  className="photo-item"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/photos/${photo.id}/thumbnail?size=300`}
                    alt={photo.filename}
                    loading="lazy"
                    decoding="async"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  {previewTags.length > 0 && (
                    <div className="photo-overlay">
                      {previewTags.map(tag => (
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

          {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
          {!hasMore && photos.length > 0 && (
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', padding: '16px 0' }}>
              {photos.length} fotos con el tag «{tagName}»
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
