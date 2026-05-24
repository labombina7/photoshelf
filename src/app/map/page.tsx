import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { countWithGps, getMapYears } from '@/lib/queries/photos';
import { getSidebarData } from '@/lib/queries/sidebar';
import { getActiveCatalogId } from '@/lib/catalog-context';
import MapWrapper from './MapWrapper';

export default async function MapPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const catalogId = await getActiveCatalogId();
  const sidebar = getSidebarData(catalogId);
  const availableYears = getMapYears(catalogId);
  const initialYear = availableYears[0] ?? null;
  const withGps = initialYear !== null ? countWithGps(initialYear, catalogId) : countWithGps(undefined, catalogId);

  return (
    <MapWrapper
      total={sidebar.totalPhotos}
      withGps={withGps}
      themes={sidebar.themes}
      projects={sidebar.projects}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
      availableYears={availableYears}
      initialYear={initialYear}
      catalogs={sidebar.catalogs}
      activeCatalogId={catalogId}
    />
  );
}
