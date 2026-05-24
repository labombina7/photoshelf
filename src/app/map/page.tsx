import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { countWithGps } from '@/lib/queries/photos';
import { getSidebarData } from '@/lib/queries/sidebar';
import MapWrapper from './MapWrapper';

export default async function MapPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const sidebar = getSidebarData();
  const withGps = countWithGps();

  return (
    <MapWrapper
      total={sidebar.totalPhotos}
      withGps={withGps}
      themes={sidebar.themes}
      projects={sidebar.projects}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
    />
  );
}
