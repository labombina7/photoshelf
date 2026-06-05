import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getSidebarData } from '@/lib/queries/sidebar';
import { getActiveCatalogId } from '@/lib/catalog-context';
import RoadmapClient from './RoadmapClient';

export default async function RoadmapPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const catalogId = await getActiveCatalogId();
  const sidebar = getSidebarData(catalogId);

  return (
    <RoadmapClient
      themes={sidebar.themes}
      projects={sidebar.projects}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
      catalogs={sidebar.catalogs}
      activeCatalogId={catalogId}
    />
  );
}
