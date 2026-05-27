import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError } from '@/lib/api';
import { getAdjacentInTimeline, getAdjacentInEvent, getAdjacentInTag } from '@/lib/queries/photos';

export const dynamic = 'force-dynamic';

interface Params { params: Promise<{ id: string }> }

export function GET(req: NextRequest, { params }: Params) {
  return withAuth(async (_req, session) => {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return apiError('BAD_REQUEST', 'Invalid photo ID', 400);

    const catalogId    = session.catalogId ?? 1;
    const sp           = req.nextUrl.searchParams;
    const context      = sp.get('context') ?? 'timeline';
    const contextValue = sp.get('contextValue') ?? undefined;

    let adjacent;
    if (context === 'event') {
      adjacent = getAdjacentInEvent(id, catalogId);
    } else if (context === 'tag') {
      if (!contextValue) return apiError('BAD_REQUEST', 'contextValue required for tag context', 400);
      adjacent = getAdjacentInTag(id, contextValue, catalogId);
    } else {
      adjacent = getAdjacentInTimeline(id, catalogId);
    }

    return apiSuccess(adjacent);
  })(req);
}
