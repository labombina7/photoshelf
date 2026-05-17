import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const themes = db.prepare(`
    SELECT th.id, th.name, th.color,
           COUNT(pt.photo_id) as photo_count
    FROM themes th
    LEFT JOIN photo_themes pt ON pt.theme_id = th.id
    GROUP BY th.id
    ORDER BY th.name ASC
  `).all();
  return NextResponse.json(themes);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, color = '#888888' } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const db = getDb();
  const result = db.prepare('INSERT INTO themes (name, color) VALUES (?, ?)').run(name.trim(), color);
  return NextResponse.json({ id: result.lastInsertRowid, name: name.trim(), color });
}
