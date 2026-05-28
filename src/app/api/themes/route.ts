import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listThemes, createTheme } from '@/lib/queries/themes';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json(listThemes(session.catalogId ?? 1));
  } catch (err) {
    console.error('[themes] Error listing themes:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { name, color = '#888888' } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const theme = createTheme(name.trim(), color);
    return NextResponse.json(theme);
  } catch (err) {
    console.error('[themes] Error creating theme:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
