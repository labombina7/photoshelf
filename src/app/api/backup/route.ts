import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { runBackup } from '@/lib/backup';

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await runBackup();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[backup] Error running backup:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error al crear el backup' }, { status: 500 });
  }
}
