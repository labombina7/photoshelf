import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getTimelineRows } from '@/lib/queries/timeline';
import { getSidebarData } from '@/lib/queries/sidebar';
import TimelineClient from './TimelineClient';

export default async function TimelinePage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const sidebar = getSidebarData();
  const { rows, hasMore, nextCursor } = getTimelineRows(60);

  return (
    <TimelineClient
      initialRows={rows}
      initialNextCursor={nextCursor}
      initialHasMore={hasMore}
      themes={sidebar.themes}
      projects={sidebar.projects}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
    />
  );
}
