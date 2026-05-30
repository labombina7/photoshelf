import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getProjectList } from '@/lib/queries/projects';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const projects = getProjectList();
    return NextResponse.json(projects);
  } catch (err) {
    console.error('[projects] Error listing projects:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
