import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';

// Add a single theme to a photo (used by AI search save)
export async function POST(req: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photoId } = await params;
  const { themeId }: { themeId: number } = await req.json();
  const db = getDb();
  const pid = parseInt(photoId, 10);

  db.prepare('INSERT OR IGNORE INTO photo_themes (photo_id, theme_id) VALUES (?, ?)').run(pid, themeId);
  return NextResponse.json({ ok: true });
}

// Replace all themes for a photo (used by detail panel)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photoId } = await params;
  const { themeIds }: { themeIds: number[] } = await req.json();
  const db = getDb();
  const pid = parseInt(photoId, 10);

  const update = db.transaction(() => {
    db.prepare('DELETE FROM photo_themes WHERE photo_id = ?').run(pid);
    for (const tid of themeIds) {
      db.prepare('INSERT OR IGNORE INTO photo_themes (photo_id, theme_id) VALUES (?, ?)').run(pid, tid);
    }
  });
  update();

  return NextResponse.json({ ok: true });
}
