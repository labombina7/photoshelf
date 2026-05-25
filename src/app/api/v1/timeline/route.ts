import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError } from '@/lib/api';
import { getTimelineRows } from '@/lib/queries/timeline';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, session) => {
  const sp     = req.nextUrl.searchParams;
  const cursor = sp.get('cursor') ?? null;
  const limit  = Math.min(parseInt(sp.get('limit') ?? '60', 10) || 60, 120);
  const catalogId = session.catalogId ?? 1;

  if (isNaN(limit)) return apiError('BAD_REQUEST', 'Invalid limit', 400);

  const { rows, hasMore, nextCursor } = getTimelineRows(limit, cursor, catalogId);

  return apiSuccess(rows, { hasMore, nextCursor, limit });
});
