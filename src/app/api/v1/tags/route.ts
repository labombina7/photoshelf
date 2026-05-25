import { withAuth, apiSuccess } from '@/lib/api';
import { listTagsWithCounts } from '@/lib/queries/tags';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req, session) => {
  const tags = listTagsWithCounts(session.catalogId ?? 1);
  return apiSuccess(tags);
});
