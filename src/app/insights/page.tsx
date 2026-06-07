import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getSidebarData } from '@/lib/queries/sidebar';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { getBootstrapProgress } from '@/lib/queries/style-analysis';
import { GET as getYears } from '@/app/api/insights/years/route';
import InsightsClient from './InsightsClient';
import type { YearData } from '@/app/api/insights/years/route';

export default async function InsightsPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const catalogId = await getActiveCatalogId();
  const sidebar = getSidebarData(catalogId);
  const bootstrapProgress = getBootstrapProgress();

  // Call the years endpoint logic directly (server-side, no HTTP round-trip)
  let years: YearData[] = [];
  try {
    const res = await getYears();
    years = await res.json() as YearData[];
  } catch { /* empty catalog */ }

  return (
    <InsightsClient
      bootstrapProgress={bootstrapProgress}
      years={years}
      themes={sidebar.themes}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
      catalogs={sidebar.catalogs}
      activeCatalogId={catalogId}
    />
  );
}
