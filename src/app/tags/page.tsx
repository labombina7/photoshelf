import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { listTagsWithCounts } from '@/lib/queries/tags';
import { getSidebarData } from '@/lib/queries/sidebar';
import { getActiveCatalogId } from '@/lib/catalog-context';
import TagsClient from './TagsClient';

export default async function TagsPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const catalogId = await getActiveCatalogId();
  const tags    = listTagsWithCounts(catalogId);
  const sidebar = getSidebarData(catalogId);

  return (
    <TagsClient
      tags={tags}
      themes={sidebar.themes}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
      catalogs={sidebar.catalogs}
      activeCatalogId={catalogId}
    />
  );
}
