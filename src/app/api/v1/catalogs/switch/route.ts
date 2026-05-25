import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError } from '@/lib/api';
import { getCatalogById } from '@/lib/queries/catalogs';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req, session) => {
  const body = await req.json() as { catalogId?: unknown };
  const catalogId = body.catalogId;

  if (typeof catalogId !== 'number' || !Number.isInteger(catalogId)) {
    return apiError('BAD_REQUEST', 'catalogId must be an integer', 400);
  }

  const catalog = getCatalogById(catalogId);
  if (!catalog) return apiError('NOT_FOUND', 'Catalog not found', 404);

  session.catalogId = catalogId;
  await session.save();

  return apiSuccess({ catalog });
});
