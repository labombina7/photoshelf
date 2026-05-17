import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { scanLibrary } from '@/lib/scanner';

const PHOTOS_PATH = process.env.PHOTOS_PATH ?? '/photos';

export const maxDuration = 300;

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await scanLibrary(PHOTOS_PATH);
  return NextResponse.json(result);
}
