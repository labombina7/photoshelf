import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getSidebarData } from '@/lib/queries/sidebar';
import { getStatsOverview, getPhotosByYear, getPhotosByMonth, getTopCameras, getTopTags, getPhotosByHour } from '@/lib/queries/stats';
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

  const sp = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = sp.year ? parseInt(sp.year, 10) : currentYear;

  const sidebar  = getSidebarData();
  const overview = getStatsOverview();

  const stats: StatsData = {
    overview,
    byYear:       getPhotosByYear(),
    byMonth:      getPhotosByMonth(selectedYear),
    selectedYear,
    cameras:      getTopCameras(6),
    tags:         getTopTags(20),
    byHour:       getPhotosByHour(),
  };

  return (
    <StatsClient
      stats={stats}
      themes={sidebar.themes}
      projects={sidebar.projects}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
    />
  );
}
