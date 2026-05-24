import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export interface SessionData {
  isLoggedIn: boolean;
  /** ID del catálogo activo — default 1 (Principal) */
  catalogId?: number;
}

function getSessionOptions() {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV !== 'test') {
    throw new Error('SESSION_SECRET environment variable must be set to a secure random string');
  }
  return {
    password: secret ?? 'test-secret-for-testing-only',
    cookieName: 'photoshelf_session',
    cookieOptions: {
      // Default false — this app runs over HTTP on a private LAN.
      // Set COOKIE_SECURE=true only if you've set up TLS in front of it.
      secure: process.env.COOKIE_SECURE === 'true',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD ?? '';
  if (!expected || input.length !== expected.length) {
    // still do comparison to avoid timing attacks on length
    const dummy = expected || 'xxxxxxxxxxxxxxxx';
    try {
      const a = Buffer.from(input.padEnd(dummy.length, '\0'));
      const b = Buffer.from(dummy.padEnd(input.length, '\0'));
      crypto.timingSafeEqual(a, b);
    } catch {}
    return false;
  }
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return crypto.timingSafeEqual(a, b);
}
