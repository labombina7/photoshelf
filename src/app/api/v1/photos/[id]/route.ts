import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError } from '@/lib/api';
import { getPhotoById } from '@/lib/queries/photos';

export const dynamic = 'force-dynamic';

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return apiError('BAD_REQUEST', 'Invalid photo ID', 400);

  return withAuth(async (_req, _session) => {
    const photo = getPhotoById(id);
    if (!photo) return apiError('NOT_FOUND', 'Photo not found', 404);
    return apiSuccess({
      ...photo,
      thumbnail_url: `/api/v1/photos/${id}/thumbnail`,
      original_url:  `/api/v1/photos/${id}/original`,
    });
  })(req);
}
