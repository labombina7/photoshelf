import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getClassifyState } from '@/lib/classifyState';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(getClassifyState());
  } catch (err) {
    console.error('[classify/status] Error fetching classify state:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
