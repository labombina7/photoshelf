import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getSidebarData } from '@/lib/queries/sidebar';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { getBootstrapProgress, getLatestProfiles } from '@/lib/queries/style-analysis';
import InsightsClient from './InsightsClient';

export default async function InsightsPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const catalogId = await getActiveCatalogId();
  const [sidebar, bootstrapProgress, annualProfiles, monthlyProfiles] = await Promise.all([
    Promise.resolve(getSidebarData(catalogId)),
    Promise.resolve(getBootstrapProgress()),
    Promise.resolve(getLatestProfiles(20, 'annual_historical')),
    Promise.resolve(getLatestProfiles(24, 'monthly')),
  ]);

  return (
    <InsightsClient
      bootstrapProgress={bootstrapProgress}
      annualProfiles={annualProfiles}
      monthlyProfiles={monthlyProfiles}
      themes={sidebar.themes}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
      catalogs={sidebar.catalogs}
      activeCatalogId={catalogId}
    />
  );
}
