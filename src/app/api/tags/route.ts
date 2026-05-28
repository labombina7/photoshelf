import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listAllTags } from '@/lib/queries/tags';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json(listAllTags());
  } catch (err) {
    console.error('[tags] Error listing tags:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
