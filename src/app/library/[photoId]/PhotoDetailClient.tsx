'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import DetailPanel from '@/components/DetailPanel';
import BottomSheet from '@/components/BottomSheet';
import { IconChevronLeft, IconChevronRight, IconMenu } from '@/components/Icons';
import type { PhotoDetail, Theme } from '@/lib/types';

interface Props {
  photo: PhotoDetail;
  allThemes: Theme[];
  prevId: number | null;
  nextId: number | null;
  navSearch: string;
  backHref: string;
  backLabel: string;
  sidebarThemes: Theme[];
  sidebarProjects: { id: number; title: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  sidebarCatalogs?: import('@/lib/queries/catalogs').CatalogRow[];
  activeCatalogId?: number;
}

export default function PhotoDetailClient({
  photo,
  allThemes,
  prevId,
  nextId,
  navSearch,
  backHref,
  backLabel,
  sidebarThemes,
  sidebarProjects,
  totalPhotos,
  favoriteCount,
  untaggedCount,
  sidebarCatalogs = [],
  activeCatalogId = 1,
}: Props) {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(true);

  // Touch swipe state for horizontal photo navigation
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'ArrowLeft' && prevId) {
        router.push(`/library/${prevId}${navSearch}`);
      } else if (e.key === 'ArrowRight' && nextId) {
        router.push(`/library/${nextId}${navSearch}`);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevId, nextId, navSearch, router]);

  // Reset sheet open state when photo changes
  useEffect(() => {
    setMobileSheetOpen(true);
  }, [photo.id]);

  function handlePhotoAreaTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }

  function handlePhotoAreaTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const elapsed = Date.now() - touchStartTime.current;
    const velocityX = Math.abs(deltaX) / elapsed; // px/ms

    // Only handle horizontal swipes (not vertical scroll)
    if (Math.abs(deltaX) > Math.abs(deltaY) && (Math.abs(deltaX) > 50 || velocityX > 0.3)) {
      if (deltaX < 0 && nextId) {
        // Swipe left → next photo
        router.push(`/library/${nextId}${navSearch}`);
      } else if (deltaX > 0 && prevId) {
        // Swipe right → prev photo
        router.push(`/library/${prevId}${navSearch}`);
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }

  function handleBottomSheetClose() {
    setMobileSheetOpen(false);
  }

  return (
    <div className="app-shell">
      {/* Sidebar drawer (mobile) / static (desktop) */}
      <Sidebar
        themes={sidebarThemes}
        projects={sidebarProjects}
        totalPhotos={totalPhotos}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        catalogs={sidebarCatalogs}
        activeCatalogId={activeCatalogId}
      />
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileSidebarOpen(false)}
          style={{ display: 'block' }}
        />
      )}

      <div className="main">
        <div className="detail-topbar">
          {/* Hamburger — shown only on mobile via CSS */}
          <button
            className="hamburger"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <IconMenu />
          </button>

          <Link href={backHref} className="btn-back">
            <IconChevronLeft />
            {backLabel}
          </Link>
          <span style={{ color: 'var(--text-tertiary)' }}>/</span>
          <span className="detail-filename">{photo.filename}</span>

          <div className="detail-nav">
            {prevId ? (
              <Link href={`/library/${prevId}${navSearch}`} className="btn-icon">
                <IconChevronLeft />
              </Link>
            ) : (
              <button className="btn-icon" disabled style={{ opacity: 0.3 }}>
                <IconChevronLeft />
              </button>
            )}
            {nextId ? (
              <Link href={`/library/${nextId}${navSearch}`} className="btn-icon">
                <IconChevronRight />
              </Link>
            ) : (
              <button className="btn-icon" disabled style={{ opacity: 0.3 }}>
                <IconChevronRight />
              </button>
            )}
          </div>
        </div>

        <div className="detail-body">
          {/* Photo area with touch handlers */}
          <div
            className="detail-photo-area"
            onTouchStart={handlePhotoAreaTouchStart}
            onTouchEnd={handlePhotoAreaTouchEnd}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${photo.id}/thumbnail?size=1920&fit=inside`}
              alt={photo.filename}
              decoding="async"
            />
            <a
              href={`/api/photos/${photo.id}/original`}
              download={photo.filename}
              className="download-original-btn"
              title="Descargar original"
            >
              ↓ Original
            </a>

            {/* Swipe chevron indicators — only shown on mobile via CSS */}
            {prevId && (
              <div className="swipe-chevron swipe-chevron--prev" aria-hidden="true">
                <IconChevronLeft size={16} />
              </div>
            )}
            {nextId && (
              <div className="swipe-chevron swipe-chevron--next" aria-hidden="true">
                <IconChevronRight size={16} />
              </div>
            )}
          </div>

          {/* Desktop sidebar: always visible */}
          {/* Mobile: DetailPanel inside BottomSheet (when open) */}
          <div className="detail-panel-desktop">
            <DetailPanel photo={photo} allThemes={allThemes} />
          </div>

          {mobileSheetOpen ? (
            <div className="detail-panel-mobile">
              <BottomSheet onClose={handleBottomSheetClose}>
                <DetailPanel photo={photo} allThemes={allThemes} />
              </BottomSheet>
            </div>
          ) : (
            /* FAB to reopen the info sheet after dismissing it */
            <button
              className="mobile-info-fab"
              onClick={() => setMobileSheetOpen(true)}
              aria-label="Ver información de la foto"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="8" strokeWidth="3" />
                <line x1="12" y1="12" x2="12" y2="16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
