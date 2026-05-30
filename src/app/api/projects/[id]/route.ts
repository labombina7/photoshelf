import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getProjectById, updateProject, deleteProject } from '@/lib/queries/projects';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const project = getProjectById(parseInt(id, 10));
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(project);
  } catch (err) {
    console.error('[projects/id] Error fetching project:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const { title, statement, photoIds }: { title?: string; statement?: string; photoIds?: number[] } = await req.json();
    updateProject(parseInt(id, 10), { title, statement, photoIds });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[projects/id] Error updating project:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    deleteProject(parseInt(id, 10));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[projects/id] Error deleting project:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
