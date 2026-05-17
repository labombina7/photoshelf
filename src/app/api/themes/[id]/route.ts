import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { name, color } = await req.json();
  const db = getDb();

  if (name) db.prepare('UPDATE themes SET name = ? WHERE id = ?').run(name.trim(), parseInt(id, 10));
  if (color) db.prepare('UPDATE themes SET color = ? WHERE id = ?').run(color, parseInt(id, 10));

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM themes WHERE id = ?').run(parseInt(id, 10));
  return NextResponse.json({ ok: true });
}
