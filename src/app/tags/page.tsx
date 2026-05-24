import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { listTagsWithCounts } from '@/lib/queries/tags';
import { getSidebarData } from '@/lib/queries/sidebar';
import TagsClient from './TagsClient';

export default async function TagsPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const tags    = listTagsWithCounts();
  const sidebar = getSidebarData();

  return (
    <TagsClient
      tags={tags}
      themes={sidebar.themes}
      projects={sidebar.projects}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
    />
  );
}
