import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listThemes, createTheme } from '@/lib/queries/themes';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(listThemes(session.catalogId ?? 1));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, color = '#888888' } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const theme = createTheme(name.trim(), color);
  return NextResponse.json(theme);
}
