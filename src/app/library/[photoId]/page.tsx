import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { getPhotoById, getYears, getPhotoSiblings } from '@/lib/queries/photos';
import { listThemes } from '@/lib/queries/themes';
import { getSidebarData } from '@/lib/queries/sidebar';
import Sidebar from '@/components/Sidebar';
import DetailPanel from '@/components/DetailPanel';
import { IconChevronLeft, IconChevronRight } from '@/components/Icons';

interface Params { photoId: string }
interface SearchParams { year?: string; theme?: string; favorite?: string; q?: string; back?: string }

export default async function PhotoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const { photoId } = await params;
  const sp = await searchParams;
  const id = parseInt(photoId, 10);

  const photo = getPhotoById(id);
  if (!photo) notFound();

  const allThemes      = listThemes();
  const sidebar        = getSidebarData();
  const years          = getYears();

  // Prev / next within the same event
  const siblings = getPhotoSiblings(photo.year, photo.event);
  const idx      = siblings.findIndex(s => s.id === id);
  const prevId   = idx > 0 ? siblings[idx - 1].id : null;
  const nextId   = idx < siblings.length - 1 ? siblings[idx + 1].id : null;

  // `back` param carries an explicit return URL (e.g. /tags/portrait, /library?q=...)
  const { back: backOverride, ...libSp } = sp;
  const libParams = new URLSearchParams(libSp as Record<string, string>).toString();
  const backHref  = backOverride ?? `/library${libParams ? `?${libParams}` : ''}`;

  let backLabel = photo.event;
  if (backOverride) {
    try {
      const decoded = decodeURIComponent(backOverride);
      if (decoded.startsWith('/tags/')) {
        backLabel = decodeURIComponent(decoded.replace('/tags/', ''));
      }
    } catch { /* keep default */ }
  }

  const navSearch = backOverride
    ? `?back=${encodeURIComponent(backOverride)}`
    : libParams ? `?${libParams}` : '';

  // suppress unused var (years kept for Sidebar if needed in future)
  void years;

  return (
    <div className="app-shell">
      <Sidebar
        themes={allThemes}
        projects={sidebar.projects}
        totalPhotos={sidebar.totalPhotos}
        favoriteCount={sidebar.favoriteCount}
        untaggedCount={sidebar.untaggedCount}
      />

      <div className="main">
        <div className="detail-topbar">
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
              <button className="btn-icon" disabled style={{ opacity: 0.3 }}><IconChevronLeft /></button>
            )}
            {nextId ? (
              <Link href={`/library/${nextId}${navSearch}`} className="btn-icon">
                <IconChevronRight />
              </Link>
            ) : (
              <button className="btn-icon" disabled style={{ opacity: 0.3 }}><IconChevronRight /></button>
            )}
          </div>
        </div>

        <div className="detail-body">
          <div className="detail-photo-area">
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
          </div>

          <DetailPanel photo={photo} allThemes={allThemes} />
        </div>
      </div>
    </div>
  );
}
