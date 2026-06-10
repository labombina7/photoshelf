import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getSidebarData } from '@/lib/queries/sidebar';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { getEvolutionData, getEvolutionAnalysis } from '@/lib/queries/evolution';
import InsightsClient from './InsightsClient';

export default async function InsightsPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const catalogId = await getActiveCatalogId();
  const sidebar = getSidebarData(catalogId);
  const evolutionData = getEvolutionData();
  const savedAnalysis = getEvolutionAnalysis();

  return (
    <InsightsClient
      evolutionData={evolutionData}
      savedAnalysis={savedAnalysis}
      themes={sidebar.themes}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
      catalogs={sidebar.catalogs}
      activeCatalogId={catalogId}
    />
  );
}
