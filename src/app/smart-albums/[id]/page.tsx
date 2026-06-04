import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { getSidebarData } from '@/lib/queries/sidebar';
import { getSmartAlbumById, getSmartAlbumGroups } from '@/lib/queries/smartAlbums';
import { rulesFromJson } from '@/lib/smartAlbumQuery';
import SmartAlbumDetailClient from './SmartAlbumDetailClient';

export default async function SmartAlbumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const { id } = await params;
  const album = getSmartAlbumById(parseInt(id, 10));
  if (!album) notFound();

  const catalogId = await getActiveCatalogId();
  const sidebar = getSidebarData(catalogId);
  const rules = rulesFromJson(album.rules);
  const { groups, total } = getSmartAlbumGroups(rules, catalogId);

  return (
    <SmartAlbumDetailClient
      album={album}
      groups={groups}
      total={total}
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
