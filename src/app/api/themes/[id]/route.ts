import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { updateTheme, deleteTheme } from '@/lib/queries/themes';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const { name, color } = await req.json();
    updateTheme(parseInt(id, 10), name?.trim(), color);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[themes] Error updating theme:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    deleteTheme(parseInt(id, 10));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[themes] Error deleting theme:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
