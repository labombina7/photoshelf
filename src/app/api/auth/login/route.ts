import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPassword } from '@/lib/session';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!checkPassword(password)) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
  }
  const session = await getSession();
  session.isLoggedIn = true;
  await session.save();
  return NextResponse.json({ ok: true });
}
