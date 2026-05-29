'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import DetailPanel from '@/components/DetailPanel';
import BottomSheet from '@/components/BottomSheet';
import { IconChevronLeft, IconChevronRight, IconMenu, IconX } from '@/components/Icons';
import type { PhotoDetail, Theme } from '@/lib/types';

interface Props {
  photo: PhotoDetail;
  allThemes: Theme[];
  prevId: number | null;
  nextId: number | null;
  photoIndex: number;
  photoTotal: number;
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
  photoIndex,
  photoTotal,
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
  // US-035: sheet starts closed on mobile; HUD starts visible
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);

  // Touch swipe state for horizontal photo navigation
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
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

  // Reset state when photo changes
  useEffect(() => {
    setMobileSheetOpen(false);
    setHudVisible(true);
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
    const velocityX = Math.abs(deltaX) / elapsed;

    const isHorizontalSwipe =
      Math.abs(deltaX) > Math.abs(deltaY) &&
      (Math.abs(deltaX) > 50 || velocityX > 0.3);

    const isTap =
      Math.abs(deltaX) < 15 &&
      Math.abs(deltaY) < 15 &&
      elapsed < 400;

    if (isHorizontalSwipe) {
      if (deltaX < 0 && nextId) {
        router.push(`/library/${nextId}${navSearch}`);
      } else if (deltaX > 0 && prevId) {
        router.push(`/library/${prevId}${navSearch}`);
      }
    } else if (isTap) {
      // Toggle HUD via touch (avoids iOS ghost-click after navigation)
      setHudVisible(v => !v);
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }

  function handleMobileInfoOpen(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation();
    setMobileSheetOpen(true);
    setHudVisible(true);
  }

  function handleBackClick(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation();
    router.push(backHref);
  }

  return (
    // US-035: detail-viewer-shell used by CSS to hide .main on ≤640px
    <div className="app-shell detail-viewer-shell">
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
      {mobileSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileSidebarOpen(false)}
          style={{ display: 'block' }}
        />
      )}

      {/* ══ Mobile fullscreen viewer (US-035, ≤640px) ═══════════════════ */}
      {/* Hidden on desktop/tablet via CSS; activated on ≤640px */}
      <div className="photo-viewer-mobile">
        {/* Full-screen swipe + tap area (no onClick — toggle via onTouchEnd to avoid iOS ghost clicks) */}
        <div
          className="photo-viewer-bg"
          onTouchStart={handlePhotoAreaTouchStart}
          onTouchEnd={handlePhotoAreaTouchEnd}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/photos/${photo.id}/thumbnail?size=1920&fit=inside`}
            alt={photo.filename}
            className="photo-viewer-img"
            decoding="async"
          />
        </div>

        {/* HUD: top gradient bar — X close | counter | ⓘ info */}
        <div className={`photo-viewer-hud-top${hudVisible ? '' : ' photo-viewer-hud--hidden'}`}>
          <button
            className="photo-viewer-btn photo-viewer-btn--close"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => { e.stopPropagation(); router.push(backHref); }}
            onClick={handleBackClick}
            aria-label={`Volver a ${backLabel}`}
          >
            <IconX size={20} />
          </button>
          <span className="photo-viewer-counter">{photoIndex} / {photoTotal}</span>
          <button
            className="photo-viewer-btn photo-viewer-btn--info"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => { e.stopPropagation(); setMobileSheetOpen(true); setHudVisible(true); }}
            onClick={handleMobileInfoOpen}
            aria-label="Información de la foto"
          >
            ⓘ
          </button>
        </div>

        {/* Navigation: prev arrow */}
        {prevId && (
          <Link
            href={`/library/${prevId}${navSearch}`}
            className={`photo-viewer-nav photo-viewer-nav--prev${hudVisible ? '' : ' photo-viewer-hud--hidden'}`}
            aria-label="Foto anterior"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <IconChevronLeft size={30} />
          </Link>
        )}

        {/* Navigation: next arrow */}
        {nextId && (
          <Link
            href={`/library/${nextId}${navSearch}`}
            className={`photo-viewer-nav photo-viewer-nav--next${hudVisible ? '' : ' photo-viewer-hud--hidden'}`}
            aria-label="Foto siguiente"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <IconChevronRight size={30} />
          </Link>
        )}

        {/* Info bottom sheet — opens when ⓘ is pressed */}
        {mobileSheetOpen && (
          <BottomSheet onClose={() => setMobileSheetOpen(false)}>
            <DetailPanel photo={photo} allThemes={allThemes} />
          </BottomSheet>
        )}
      </div>

      {/* ══ Desktop + tablet layout (≥641px) ═══════════════════════════ */}
      {/* Hidden on ≤640px via CSS (.detail-viewer-shell > .main { display: none }) */}
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
            <span className="detail-counter">{photoIndex} / {photoTotal}</span>
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
          {/* Photo area with touch handlers (tablet 641–768px + desktop) */}
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

            {/* Swipe chevron indicators — only shown on tablet via CSS */}
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
          <div className="detail-panel-desktop">
            <DetailPanel photo={photo} allThemes={allThemes} />
          </div>

          {/* Tablet (641–768px): bottom sheet or FAB */}
          <div className="detail-panel-mobile">
            {mobileSheetOpen ? (
              <BottomSheet onClose={() => setMobileSheetOpen(false)}>
                <DetailPanel photo={photo} allThemes={allThemes} />
              </BottomSheet>
            ) : (
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
    </div>
  );
}
