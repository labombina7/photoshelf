import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { getSidebarData } from '@/lib/queries/sidebar';
import { listSmartAlbums } from '@/lib/queries/smartAlbums';
import SmartAlbumsClient from './SmartAlbumsClient';

export default async function SmartAlbumsPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const catalogId = await getActiveCatalogId();
  const sidebar = getSidebarData(catalogId);
  const albums = listSmartAlbums(catalogId);

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
    />
  );
}
