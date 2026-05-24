import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getPhotoById, getYears, getPhotoSiblings } from '@/lib/queries/photos';
import { listThemes } from '@/lib/queries/themes';
import { getSidebarData } from '@/lib/queries/sidebar';
import PhotoDetailClient from './PhotoDetailClient';

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
    <PhotoDetailClient
      photo={photo}
      allThemes={allThemes}
      prevId={prevId}
      nextId={nextId}
      navSearch={navSearch}
      backHref={backHref}
      backLabel={backLabel}
      sidebarThemes={sidebar.themes}
      sidebarProjects={sidebar.projects}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
    />
  );
}
