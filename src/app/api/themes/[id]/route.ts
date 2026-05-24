import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { updateTheme, deleteTheme } from '@/lib/queries/themes';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { name, color } = await req.json();
  updateTheme(parseInt(id, 10), name?.trim(), color);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  deleteTheme(parseInt(id, 10));
  return NextResponse.json({ ok: true });
}
