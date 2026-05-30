import { NextRequest, NextResponse } from 'next/server';

/**
 * Lightweight presence check for all /api/* routes.
 * Full iron-session validation happens inside each handler via getSession().
 * /api/auth/login is excluded — it is the unauthenticated entry point.
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
  matcher: ['/api/((?!auth/login).*)'],
};
