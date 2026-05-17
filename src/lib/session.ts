import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  isLoggedIn: boolean;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET ?? 'default-dev-secret-change-in-production!!',
  cookieName: 'photoshelf_session',
  cookieOptions: {
    secure: false,
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD ?? '';
  if (!expected || input.length !== expected.length) {
    // still do comparison to avoid timing attacks on length
    const dummy = expected || 'xxxxxxxxxxxxxxxx';
    try {
      const a = Buffer.from(input.padEnd(dummy.length, '\0'));
      const b = Buffer.from(dummy.padEnd(input.length, '\0'));
      require('crypto').timingSafeEqual(a, b);
    } catch {}
    return false;
  }
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return require('crypto').timingSafeEqual(a, b);
}
