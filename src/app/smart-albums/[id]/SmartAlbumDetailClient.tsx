'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { IconEdit, IconMenu } from '@/components/Icons';
import ShareButton from '@/components/ShareButton';
import { useHeaderSlotLeft } from '@/components/HeaderSlot';
import SmartAlbumBuilder from '../SmartAlbumBuilder';
import type { Theme } from '@/lib/types';
import type { CatalogRow } from '@/lib/queries/catalogs';
import type { AlbumRule } from '@/lib/smartAlbumQuery';
import type { AlbumPhotoRow } from '@/lib/queries/smartAlbums';

interface AlbumData {
  id: number;
  name: string;
  rules: string;
  created_at: string;
}

interface SmartAlbumDetailClientProps {
  album: AlbumData;
  initialPhotos: AlbumPhotoRow[];
  initialHasMore: boolean;
  initialNextCursor: string | null;
  total: number;
  themes: Theme[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs: CatalogRow[];
  activeCatalogId: number;
}

const THUMB_SIZE = 200;

export default function SmartAlbumDetailClient({
  album,
  initialPhotos,
  initialHasMore,
  initialNextCursor,
  total,
  themes,
  totalPhotos,
  favoriteCount,
  untaggedCount,
  catalogs,
  activeCatalogId,
}: SmartAlbumDetailClientProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState<AlbumPhotoRow[]>(initialPhotos);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useHeaderSlotLeft(useMemo(() => (
    <div className="header-slot-library">
      <button className="hamburger header-slot-hamburger" onClick={() => setMobileOpen(true)} title="Menú">
        <IconMenu size={18} />
      </button>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), []));

  const fetchMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextCursor) params.set('cursor', nextCursor);
      const res = await fetch(`/api/smart-albums/${album.id}/photos?${params}`);
      const data = await res.json() as { rows: AlbumPhotoRow[]; hasMore: boolean; nextCursor: string | null };
      setPhotos(prev => [...prev, ...data.rows]);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (err) {
      console.error('[SmartAlbumDetail] fetchMore error:', err);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, nextCursor, album.id]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchMore(); },
      { rootMargin: '600px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchMore]);

  async function handleSave(name: string, rules: AlbumRule[]) {
    await fetch(`/api/smart-albums/${album.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rules }),
    });
    setShowBuilder(false);
    router.refresh();
  }

  const initialRules: AlbumRule[] = (() => {
    try { return JSON.parse(album.rules); } catch { return []; }
  })();

  return (
    <div className="app-shell">
      <Sidebar
        catalogs={catalogs}
        activeCatalogId={activeCatalogId}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="main">
        <div className="content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <IconMenu size={20} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link href="/smart-albums" style={{ color: 'var(--text-tertiary)', fontSize: 13, textDecoration: 'none' }}>
                  Álbumes
                </Link>
                <span style={{ color: 'var(--text-tertiary)' }}>/</span>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {album.name}
                </h1>
                <button
                  onClick={() => setShowBuilder(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                  title="Editar reglas"
                >
                  <IconEdit size={14} />
                </button>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                {total.toLocaleString('es')} fotos
                {total > 0 && (
                  <ShareButton albumId={album.id} label={album.name} className="collapse-btn" />
                )}
              </p>
            </div>
          </div>

          {photos.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '64px 0' }}>
              <p style={{ margin: 0, fontSize: 15 }}>Ninguna foto cumple las reglas de este álbum</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${THUMB_SIZE}px, 1fr))`,
              gap: 4,
            }}>
              {photos.map(photo => (
                <Link
                  key={photo.id}
                  href={`/library/${photo.id}`}
                  style={{ display: 'block', aspectRatio: '1', overflow: 'hidden', background: 'var(--surface)', borderRadius: 2, position: 'relative' }}
                  onClick={() => {
                    try {
                      sessionStorage.setItem('photoshelf_detail_origin', JSON.stringify({
                        href: window.location.pathname,
                        label: album.name,
                      }));
                    } catch {}
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/photos/${photo.id}/thumbnail?size=${THUMB_SIZE}`}
                    alt={photo.filename}
                    ref={el => { if (el?.complete) el.classList.add('loaded'); }}
                    onLoad={e => (e.currentTarget as HTMLImageElement).classList.add('loaded')}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {photo.tags_preview && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
                      padding: '12px 6px 4px',
                      display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end',
                    }}>
                      {photo.tags_preview.split(', ').slice(0, 2).map(tag => (
                        <span key={tag} style={{
                          background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 10,
                          padding: '1px 5px', borderRadius: 3,
                        }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}

          <div ref={sentinelRef} style={{ height: 1 }} />
          {loading && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>
              <span className="spinner dark" />
            </div>
          )}
        </div>
      </div>

      {showBuilder && (
        <SmartAlbumBuilder
          initialName={album.name}
          initialRules={initialRules}
          themes={themes}
          onSave={handleSave}
          onClose={() => setShowBuilder(false)}
        />
      )}
    </div>
  );
}
