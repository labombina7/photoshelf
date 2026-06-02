import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { getDb } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const catalogId = await getActiveCatalogId();
    const db = getDb();

    // ISO distribution
    const isoRanges = [
      { label: '≤400',      min: 0,    max: 400   },
      { label: '401–1600',  min: 401,  max: 1600  },
      { label: '1601–6400', min: 1601, max: 6400  },
      { label: '≥6401',     min: 6401, max: null  },
    ];
    const iso = isoRanges.map(({ label, min, max }) => {
      const row = max !== null
        ? db.prepare(`SELECT COUNT(*) as c FROM photos WHERE catalog_id = ? AND iso >= ? AND iso <= ?`).get(catalogId, min, max) as { c: number }
        : db.prepare(`SELECT COUNT(*) as c FROM photos WHERE catalog_id = ? AND iso >= ?`).get(catalogId, min) as { c: number };
      return { range: label, count: row.c };
    });

    // Aperture top 8
    const apertureRows = db.prepare(`
      SELECT aperture, COUNT(*) as count
      FROM photos
      WHERE catalog_id = ? AND aperture IS NOT NULL
      GROUP BY aperture
      ORDER BY count DESC
      LIMIT 8
    `).all(catalogId) as { aperture: number; count: number }[];
    const aperture = apertureRows.map(r => ({ value: `f/${r.aperture}`, count: r.count }));

    // Focal length categories
    const focalCategories = [
      { label: 'Gran angular ≤28mm', min: 0,   max: 28  },
      { label: 'Normal 29–60mm',     min: 29,  max: 60  },
      { label: 'Retrato 61–100mm',   min: 61,  max: 100 },
      { label: 'Tele >100mm',        min: 101, max: null },
    ];
    const focal = focalCategories.map(({ label, min, max }) => {
      const row = max !== null
        ? db.prepare(`SELECT COUNT(*) as c FROM photos WHERE catalog_id = ? AND focal_length >= ? AND focal_length <= ?`).get(catalogId, min, max) as { c: number }
        : db.prepare(`SELECT COUNT(*) as c FROM photos WHERE catalog_id = ? AND focal_length >= ?`).get(catalogId, min) as { c: number };
      return { range: label, count: row.c };
    });

    // Top 5 cameras
    const topCameras = db.prepare(`
      SELECT camera, COUNT(*) as count
      FROM photos
      WHERE catalog_id = ? AND camera IS NOT NULL
      GROUP BY camera
      ORDER BY count DESC
      LIMIT 5
    `).all(catalogId) as { camera: string; count: number }[];

    return NextResponse.json({ iso, aperture, focal, topCameras });
  } catch (err) {
    console.error('[stats/technical] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
