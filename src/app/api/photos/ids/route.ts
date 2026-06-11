import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listPhotoIds } from '@/lib/queries/photos';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const catalogId = session.catalogId ?? 1;
    const sp        = req.nextUrl.searchParams;

    const year          = sp.get('year');
    const event         = sp.get('event');
    const theme         = sp.get('theme');
    const tag           = sp.get('tag');
    const favorite      = sp.get('favorite');
    const untagged      = sp.get('untagged');
    const q             = sp.get('q');
    const iso_min       = sp.get('iso_min');
    const iso_max       = sp.get('iso_max');
    const aperture_min  = sp.get('aperture_min');
    const aperture_max  = sp.get('aperture_max');
    const shutter_min   = sp.get('shutter_min');
    const shutter_max   = sp.get('shutter_max');
    const focal_min     = sp.get('focal_min');
    const focal_max     = sp.get('focal_max');
    const camera        = sp.get('camera');

    const result = listPhotoIds({
      year, event, theme, tag, favorite, untagged, q, catalogId,
      iso_min, iso_max, aperture_min, aperture_max,
      shutter_min, shutter_max, focal_min, focal_max, camera,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[photos/ids] Error listing photo ids:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
