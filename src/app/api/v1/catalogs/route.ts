import { withAuth, apiSuccess } from '@/lib/api';
import { listCatalogs } from '@/lib/queries/catalogs';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req, session) => {
  const catalogs = listCatalogs();
  return apiSuccess({ catalogs, activeCatalogId: session.catalogId ?? 1 });
});
