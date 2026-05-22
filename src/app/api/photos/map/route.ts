import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const photos = db.prepare(`
    SELECT id, filename, taken_at, event, gps_lat, gps_lon
    FROM photos
    WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL
    ORDER BY taken_at DESC NULLS LAST
    LIMIT 10000
  `).all() as { id: number; filename: string; taken_at: string | null; event: string; gps_lat: number; gps_lon: number }[];

  const total = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;

  return NextResponse.json({ photos, total, withGps: photos.length });
}
