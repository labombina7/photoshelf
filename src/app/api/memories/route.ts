import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getMemoriesForDate } from '@/lib/queries/memories';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const catalogId = session.catalogId ?? 1;
    const sp = req.nextUrl.searchParams;

    let date = sp.get('date'); // MM-DD
    if (!date) {
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      date = `${mm}-${dd}`;
    }

    if (!/^\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use MM-DD' }, { status: 400 });
    }

    const result = getMemoriesForDate(date, catalogId);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[memories] Error fetching memories:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
