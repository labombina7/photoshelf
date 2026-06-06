import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getTimelineRows } from '@/lib/queries/timeline';
import { getSidebarData } from '@/lib/queries/sidebar';
import { getActiveCatalogId } from '@/lib/catalog-context';
import TimelineClient from './TimelineClient';

export default async function TimelinePage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const catalogId = await getActiveCatalogId();

  let sidebar: ReturnType<typeof getSidebarData>;
  let timelineResult: ReturnType<typeof getTimelineRows>;
  try {
    sidebar = getSidebarData(catalogId);
    timelineResult = getTimelineRows(60, null, catalogId);
  } catch (err) {
    console.error('[Timeline/page] Error loading data for catalog', catalogId, ':', err);
    throw err; // re-throw so error.tsx catches it
  }
  const { rows, hasMore, nextCursor } = timelineResult;

  return (
    <TimelineClient
      initialRows={rows}
      initialNextCursor={nextCursor}
      initialHasMore={hasMore}
      themes={sidebar.themes}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
      catalogs={sidebar.catalogs}
      activeCatalogId={catalogId}
    />
  );
}
