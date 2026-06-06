import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { listCatalogs } from '@/lib/queries/catalogs';
import { getSidebarData } from '@/lib/queries/sidebar';
import { getActiveCatalogId } from '@/lib/catalog-context';
import CatalogsClient from './CatalogsClient';

export default async function CatalogsSettingsPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const catalogId = await getActiveCatalogId();
  const catalogs  = listCatalogs();
  const sidebar   = getSidebarData(catalogId);

  return (
    <CatalogsClient
      catalogs={catalogs}
      activeCatalogId={catalogId}
      themes={sidebar.themes}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
      sidebarCatalogs={sidebar.catalogs}
    />
  );
}
