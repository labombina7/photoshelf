import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, parsePagination } from '@/lib/api';
import { listPhotos } from '@/lib/queries/photos';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, session) => {
  const sp = req.nextUrl.searchParams;

  const year     = sp.get('year')     ?? undefined;
  const event    = sp.get('event')    ?? undefined;
  const theme    = sp.get('theme')    ?? undefined;
  const tag      = sp.get('tag')      ?? undefined;
  const favorite = sp.get('favorite') ?? undefined;
  const untagged = sp.get('untagged') ?? undefined;
  const q        = sp.get('q')        ?? undefined;
  const catalogId = session.catalogId ?? 1;

  const { limit, offset } = parsePagination(sp);

  const { photos, total } = listPhotos(
    { year, event, theme, tag, favorite, untagged, q, catalogId },
    { limit, offset },
  );

  if (isNaN(limit)) return apiError('BAD_REQUEST', 'Invalid pagination params', 400);

  return apiSuccess(photos, {
    total,
    limit,
    offset,
    hasMore: offset + photos.length < total,
  });
});
