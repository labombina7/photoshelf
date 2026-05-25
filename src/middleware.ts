import { NextRequest, NextResponse } from 'next/server';

/**
 * Lightweight presence check for /api/v1/* routes.
 * Full iron-session validation happens inside each handler via withAuth().
 */
export function middleware(req: NextRequest) {
  const cookie = req.cookies.get('photoshelf_session');
  if (!cookie?.value) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'UNAUTHORIZED', status: 401 },
      { status: 401 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/v1/:path*'],
};
