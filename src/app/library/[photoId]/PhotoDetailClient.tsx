'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import DetailPanel from '@/components/DetailPanel';
import BottomSheet from '@/components/BottomSheet';
import Slideshow from '@/components/Slideshow';
import { IconChevronLeft, IconChevronRight, IconMenu, IconX } from '@/components/Icons';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { PhotoDetail, Theme, CatalogRow } from '@/lib/types';
import { SWIPE_THRESHOLD_PX, SWIPE_VELOCITY_PX_MS, TAP_SLOP_PX, TAP_MAX_MS } from '@/lib/gestures';

interface Props {
  photo: PhotoDetail;
  allThemes: Theme[];
  prevId: number | null;
  nextId: number | null;
  photoIndex: number;
  photoTotal: number;
  siblingIds: number[];
  navSearch: string;
  backHref: string;
  backLabel: string;
  sidebarThemes: Theme[];
  sidebarProjects: { id: number; title: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  sidebarCatalogs?: CatalogRow[];
  activeCatalogId?: number;
}

export default function PhotoDetailClient({
  photo,
  allThemes,
  prevId,
  nextId,
  photoIndex,
  photoTotal,
  siblingIds,
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
  const { track } = useAnalytics();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // US-035: sheet starts closed on mobile; HUD starts visible
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const slideshowOpenRef = useRef(false);
  const slideshowStartIndex = siblingIds.indexOf(photo.id);

  // Keep ref in sync with state so the keydown handler always sees the current value
  useEffect(() => { slideshowOpenRef.current = slideshowOpen; }, [slideshowOpen]);

  // US-040: resolve back href/label from sessionStorage (preserves origin URL exactly)
  const [resolvedBackHref, setResolvedBackHref] = useState(backHref);
  const [resolvedBackLabel, setResolvedBackLabel] = useState(backLabel);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('photoshelf_detail_origin');
      if (stored) {
        const { href, label } = JSON.parse(stored) as { href: string; label: string };
        setResolvedBackHref(href);
        setResolvedBackLabel(label);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (slideshowOpenRef.current) return; // flechas y Escape los gestiona Slideshow
      if (e.key === 'ArrowLeft' && prevId) {
        router.push(`/library/${prevId}${navSearch}`);
      } else if (e.key === 'ArrowRight' && nextId) {
        router.push(`/library/${nextId}${navSearch}`);
      } else if (e.key === 'p' || e.key === 'P') {
        setSlideshowOpen(v => !v);
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
      (Math.abs(deltaX) > SWIPE_THRESHOLD_PX || velocityX > SWIPE_VELOCITY_PX_MS);

    const isTap =
      Math.abs(deltaX) < TAP_SLOP_PX &&
      Math.abs(deltaY) < TAP_SLOP_PX &&
      elapsed < TAP_MAX_MS;

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

  function clearOrigin() {
    try { sessionStorage.removeItem('photoshelf_detail_origin'); } catch {}
  }

  function handleBackClick(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation();
    clearOrigin();
    router.push(resolvedBackHref);
  }

  return (
    // US-035: detail-viewer-shell used by CSS to hide .main on ≤640px
    <div className="app-shell detail-viewer-shell">
      {slideshowOpen && siblingIds.length > 0 && (
        <Slideshow
          photoIds={siblingIds}
          startIndex={slideshowStartIndex >= 0 ? slideshowStartIndex : 0}
          onClose={() => setSlideshowOpen(false)}
        />
      )}
      {/* Sidebar drawer (mobile) / static (desktop) */}
      <Sidebar
        themes={sidebarThemes}
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
            onTouchEnd={(e) => { e.stopPropagation(); clearOrigin(); router.push(resolvedBackHref); }}
            onClick={handleBackClick}
            aria-label={`Volver a ${resolvedBackLabel}`}
          >
            <IconX size={20} />
          </button>
          <span className="photo-viewer-counter">{photoIndex} / {photoTotal}</span>
          <div style={{ display: 'flex', justifySelf: 'end', gap: 0 }}>
            <button
              className="photo-viewer-btn"
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => { e.stopPropagation(); setSlideshowOpen(true); }}
              onClick={(e) => { e.stopPropagation(); setSlideshowOpen(true); }}
              aria-label="Iniciar presentación"
              title="Presentación (P)"
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            </button>
            <button
              className="photo-viewer-btn photo-viewer-btn--info"
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => { e.stopPropagation(); setMobileSheetOpen(true); setHudVisible(true); }}
              onClick={handleMobileInfoOpen}
              aria-label="Información de la foto"
            >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="8" />
              <line x1="12" y1="12" x2="12" y2="16" />
            </svg>
            </button>
          </div>
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

          <Link href={resolvedBackHref} className="btn-back" onClick={clearOrigin}>
            <IconChevronLeft />
            {resolvedBackLabel}
          </Link>
          <span style={{ color: 'var(--text-tertiary)' }}>/</span>
          <span className="detail-filename">{photo.filename}</span>

          <div className="detail-nav">
            <button
              className="btn-icon"
              onClick={() => setSlideshowOpen(true)}
              title="Presentación (P)"
              aria-label="Iniciar presentación"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            </button>
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
              onClick={() => track('photo_downloaded', { photo_id: photo.id })}
            >
              Descargar original{photo.size_bytes ? ` (${(photo.size_bytes / 1024 / 1024).toFixed(1)} MB)` : ''}
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
