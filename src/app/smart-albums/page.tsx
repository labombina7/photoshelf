import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { getSidebarData } from '@/lib/queries/sidebar';
import { listSmartAlbums, hasAutoAlbums } from '@/lib/queries/smartAlbums';
import { getCatalogById } from '@/lib/queries/catalogs';
import { analyzeCatalogStructure } from '@/lib/catalogStructureAnalyzer';
import SmartAlbumsClient from './SmartAlbumsClient';

export default async function SmartAlbumsPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const catalogId = await getActiveCatalogId();
  const sidebar = getSidebarData(catalogId);
  const albums = listSmartAlbums(catalogId);

  const catalog = getCatalogById(catalogId);
  const analysis = catalog ? analyzeCatalogStructure(catalog.path, catalogId) : null;
  const isUnstructured = analysis ? !analysis.structured : false;
  const alreadyOrganized = hasAutoAlbums(catalogId);

  return (
    <SmartAlbumsClient
      albums={albums}
      themes={sidebar.themes}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
      projects={sidebar.projects}
      smartAlbums={sidebar.smartAlbums}
      catalogs={sidebar.catalogs}
      activeCatalogId={catalogId}
      catalogName={catalog?.name ?? ''}
      isUnstructured={isUnstructured}
      alreadyOrganized={alreadyOrganized}
    />
  );
}
