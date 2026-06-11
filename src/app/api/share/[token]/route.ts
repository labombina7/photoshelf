import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { revokeShareToken } from '@/lib/queries/share';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { token } = await params;
    const revoked = revokeShareToken(token);
    if (!revoked) return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[share/token] Error revoking token:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
