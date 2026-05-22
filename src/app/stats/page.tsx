import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getDb, getSidebarProjects } from '@/lib/db';
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

  const db = getDb();
  const sp = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = sp.year ? parseInt(sp.year, 10) : currentYear;

  const themes = db.prepare(`
    SELECT th.id, th.name, th.color, COUNT(pt.photo_id) as photo_count
    FROM themes th LEFT JOIN photo_themes pt ON pt.theme_id = th.id
    GROUP BY th.id ORDER BY th.name ASC
  `).all() as { id: number; name: string; color: string; photo_count: number }[];

  const projects = getSidebarProjects(db);

  const totalPhotos = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;
  const favoriteCount = (db.prepare('SELECT COUNT(*) as c FROM photos WHERE is_favorite = 1').get() as { c: number }).c;
  const untaggedCount = (db.prepare(`
    SELECT COUNT(*) as c FROM photos p
    WHERE NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id)
  `).get() as { c: number }).c;

  // Overview
  const ov = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(size_bytes), 0) as size_bytes,
      MIN(year) as min_year,
      MAX(year) as max_year,
      COUNT(DISTINCT year || '|' || event) as event_count,
      COALESCE(SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END), 0) as favorites,
      COALESCE(SUM(CASE WHEN gps_lat IS NOT NULL THEN 1 ELSE 0 END), 0) as with_gps
    FROM photos
  `).get() as {
    total: number; size_bytes: number; min_year: number | null; max_year: number | null;
    event_count: number; favorites: number; with_gps: number;
  };

  const tagCount = (db.prepare('SELECT COUNT(*) as c FROM tags').get() as { c: number }).c;
  const themeCount = (db.prepare('SELECT COUNT(*) as c FROM themes').get() as { c: number }).c;

  // Photos by year
  const byYear = db.prepare(`
    SELECT year, COUNT(*) as count FROM photos GROUP BY year ORDER BY year
  `).all() as { year: number; count: number }[];

  // Photos by month for selected year
  const byMonth = db.prepare(`
    SELECT CAST(strftime('%m', taken_at) AS INTEGER) as month, COUNT(*) as count
    FROM photos
    WHERE year = ? AND taken_at IS NOT NULL
    GROUP BY month ORDER BY month
  `).all(selectedYear) as { month: number; count: number }[];

  // Top cameras
  const cameras = db.prepare(`
    SELECT camera, COUNT(*) as count
    FROM photos
    WHERE camera IS NOT NULL AND camera != ''
    GROUP BY camera ORDER BY count DESC LIMIT 6
  `).all() as { camera: string; count: number }[];

  // Top tags with source breakdown
  const tags = db.prepare(`
    SELECT t.name,
      SUM(CASE WHEN pt.source = 'ai' THEN 1 ELSE 0 END) as ai_count,
      SUM(CASE WHEN pt.source = 'manual' THEN 1 ELSE 0 END) as manual_count,
      COUNT(*) as total
    FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id
    GROUP BY t.id
    ORDER BY total DESC LIMIT 20
  `).all() as { name: string; ai_count: number; manual_count: number; total: number }[];

  // Photos by hour
  const byHour = db.prepare(`
    SELECT CAST(strftime('%H', taken_at) AS INTEGER) as hour, COUNT(*) as count
    FROM photos WHERE taken_at IS NOT NULL
    GROUP BY hour ORDER BY hour
  `).all() as { hour: number; count: number }[];

  const stats: StatsData = {
    overview: {
      total: ov.total,
      sizeBytes: ov.size_bytes,
      minYear: ov.min_year,
      maxYear: ov.max_year,
      eventCount: ov.event_count,
      tagCount,
      themeCount,
      withGps: ov.with_gps,
      favorites: ov.favorites,
    },
    byYear,
    byMonth,
    selectedYear,
    cameras,
    tags: tags.map(t => ({ name: t.name, aiCount: t.ai_count, manualCount: t.manual_count, total: t.total })),
    byHour,
  };

  return (
    <StatsClient
      stats={stats}
      themes={themes}
      projects={projects}
      totalPhotos={totalPhotos}
      favoriteCount={favoriteCount}
      untaggedCount={untaggedCount}
    />
  );
}
