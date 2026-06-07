import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getSidebarData } from '@/lib/queries/sidebar';
import { getStatsOverview, getPhotosByYear, getPhotosByMonth, getTopCameras, getTopTags, getPhotosByHour } from '@/lib/queries/stats';
import { getActiveCatalogId } from '@/lib/catalog-context';
import StatsClient from './StatsClient';

export interface StatsData {
  overview: {
    total: number;
    sizeBytes: number;
    minYear: number | null;
    maxYear: number | null;
    eventCount: number;
    tagCount: number;
    themeCount: number;
    withGps: number;
    favorites: number;
  };
  byYear: { year: number; count: number }[];
  byMonth: { month: number; count: number }[];
  selectedYear: number;
  cameras: { camera: string; count: number }[];
  tags: { name: string; aiCount: number; manualCount: number; total: number }[];
  byHour: { hour: number; count: number }[];
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const catalogId = await getActiveCatalogId();
  const sp = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = sp.year ? parseInt(sp.year, 10) : currentYear;

  const sidebar  = getSidebarData(catalogId);
  const overview = getStatsOverview(catalogId);

  const stats: StatsData = {
    overview,
    byYear:       getPhotosByYear(catalogId),
    byMonth:      getPhotosByMonth(selectedYear, catalogId),
    selectedYear,
    cameras:      getTopCameras(6, catalogId),
    tags:         getTopTags(20, catalogId),
    byHour:       getPhotosByHour(catalogId),
  };

  return (
    <StatsClient
      stats={stats}
      themes={sidebar.themes}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
      catalogs={sidebar.catalogs}
      activeCatalogId={catalogId}
    />
  );
}
