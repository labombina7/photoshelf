import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { countWithGps } from '@/lib/queries/photos';
import { getSidebarData } from '@/lib/queries/sidebar';
import dynamic from 'next/dynamic';

const MapClient = dynamic(() => import('./MapClient'), { ssr: false });

export default async function MapPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const sidebar = getSidebarData();
  const withGps = countWithGps();

  return (
    <MapClient
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
