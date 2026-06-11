import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { OLLAMA_URL } from '@/lib/config';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      return NextResponse.json({ available: false, model: null });
    }

    const data = await res.json() as { models?: { name: string }[] };
    const visionModel = data.models?.find(m => m.name.includes('vision'));
    const model = visionModel?.name ?? data.models?.[0]?.name ?? null;

    return NextResponse.json({ available: true, model });
  } catch {
    return NextResponse.json({ available: false, model: null });
  }
}
