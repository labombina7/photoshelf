import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getTagByName, countPhotosByTag } from '@/lib/queries/tags';
import { getSidebarData } from '@/lib/queries/sidebar';
import TagPhotosClient from './TagPhotosClient';

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const { tag: encodedTag } = await params;
  const tagName = decodeURIComponent(encodedTag);

  const tagRow = getTagByName(tagName);
  if (!tagRow) notFound();

  const count   = countPhotosByTag(tagRow.id);
  const sidebar = getSidebarData();

  return (
    <TagPhotosClient
      tagName={tagName}
      total={count}
      themes={sidebar.themes}
      projects={sidebar.projects}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
    />
  );
}
