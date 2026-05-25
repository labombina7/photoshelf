import { NextRequest, NextResponse } from 'next/server';
import { getSession } from './session';
import type { IronSession } from 'iron-session';
import type { SessionData } from './session';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  total?: number;
  limit?: number;
  offset?: number;
  hasMore?: boolean;
  nextCursor?: string | null;
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorBody {
  error: string;
  code: string;
  status: number;
}

// ── Response helpers ───────────────────────────────────────────────────────────

export function apiSuccess<T>(data: T, meta?: PaginationMeta): NextResponse {
  const body: ApiResponse<T> = meta !== undefined ? { data, meta } : { data };
  return NextResponse.json(body);
}

export function apiError(code: string, message: string, status: number): NextResponse {
  const body: ApiErrorBody = { error: message, code, status };
  return NextResponse.json(body, { status });
}

// ── Pagination ─────────────────────────────────────────────────────────────────

export function parsePagination(sp: URLSearchParams): { limit: number; offset: number } {
  const limit  = Math.min(Math.max(parseInt(sp.get('limit')  ?? '50', 10) || 50, 1), 200);
  const offset = Math.max(parseInt(sp.get('offset') ?? '0',  10) || 0, 0);
  return { limit, offset };
}

// ── Auth HOF ───────────────────────────────────────────────────────────────────

type AuthedHandler = (
  req: NextRequest,
  session: IronSession<SessionData>,
) => Promise<NextResponse>;

/**
 * Wraps a route handler with session validation.
 * Errors thrown inside are caught and returned as 500 INTERNAL_ERROR.
 */
export function withAuth(handler: AuthedHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const session = await getSession();
      if (!session.isLoggedIn) return apiError('UNAUTHORIZED', 'Authentication required', 401);
      return await handler(req, session);
    } catch (err) {
      console.error('[api/v1]', err);
      return apiError('INTERNAL_ERROR', 'Internal server error', 500);
    }
  };
}
