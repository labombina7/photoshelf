import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getSidebarData } from '@/lib/queries/sidebar';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { computeHealthMetrics, computeScore, saveHealthSnapshot, getHealthHistory } from '@/lib/queries/health';
import HealthClient from './HealthClient';

export default async function HealthPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const catalogId = await getActiveCatalogId();
  const sidebar = getSidebarData(catalogId);

  const metrics = computeHealthMetrics(catalogId);
  const score = computeScore(metrics);
  saveHealthSnapshot(score, metrics);
  const history = getHealthHistory();

  return (
    <HealthClient
      initialScore={score}
      initialMetrics={metrics}
      initialHistory={history}
      themes={sidebar.themes}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
      catalogs={sidebar.catalogs}
      activeCatalogId={catalogId}
    />
  );
}
