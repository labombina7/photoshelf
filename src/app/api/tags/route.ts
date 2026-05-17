import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  const tags = db.prepare('SELECT name FROM tags ORDER BY name ASC').all();
  return NextResponse.json(tags);
}
