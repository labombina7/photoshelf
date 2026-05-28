import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { addThemeToPhoto, setPhotoThemes } from '@/lib/queries/themes';

// Add a single theme to a photo (used by AI search save)
export async function POST(req: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { photoId } = await params;
    const { themeId }: { themeId: number } = await req.json();
    addThemeToPhoto(parseInt(photoId, 10), themeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[photo-themes] Error adding theme to photo:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Replace all themes for a photo (used by detail panel)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { photoId } = await params;
    const { themeIds }: { themeIds: number[] } = await req.json();
    setPhotoThemes(parseInt(photoId, 10), themeIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[photo-themes] Error setting photo themes:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
