import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getCatalogById, listCatalogs } from '@/lib/queries/catalogs';
import { clusterPhotos } from '@/lib/albumClusterizer';
import { hasAutoAlbums } from '@/lib/queries/smartAlbums';
import OrganizeClient from './OrganizeClient';

export default async function OrganizePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const { id } = await params;
  const catalogId = parseInt(id, 10);
  if (isNaN(catalogId)) redirect('/smart-albums');

  const catalog = getCatalogById(catalogId);
  if (!catalog) redirect('/smart-albums');

  const allCatalogs = listCatalogs();
  const otherCatalogsExist = allCatalogs.some(c => c.id !== catalogId && c.photo_count > 0);
  const clusters = clusterPhotos(catalogId, otherCatalogsExist);
  const alreadyOrganized = hasAutoAlbums(catalogId);

  return (
    <OrganizeClient
      catalogId={catalogId}
      catalogName={catalog.name}
      clusters={clusters}
      alreadyOrganized={alreadyOrganized}
      otherCatalogsExist={otherCatalogsExist}
    />
  );
}
