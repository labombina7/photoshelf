import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { removeOrphansByIds, removeOrphanThumbnailsByIds, getIntegrityReportByType } from '@/lib/queries/integrity';
import fs from 'fs';
import path from 'path';
import { PHOTOS_PATH } from '@/lib/config';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { action, ids } = body as { action: string; ids: number[] };

    if (!action || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'action and ids are required' }, { status: 400 });
    }

    if (action === 'remove_orphans') {
      const removed = removeOrphansByIds(ids);
      return NextResponse.json({ removed });
    }

    if (action === 'delete_orphan_thumbnails') {
      const result = removeOrphanThumbnailsByIds(ids);
      return NextResponse.json(result);
    }

    if (action === 'quarantine_corrupt') {
      const db = getDb();
      const ph = ids.map(() => '?').join(',');
      const rows = db.prepare(
        `SELECT path FROM integrity_reports WHERE id IN (${ph}) AND type = 'corrupt'`
      ).all(...ids) as { path: string }[];

      const quarantineDir = path.join(PHOTOS_PATH, '_quarantine');
      if (!fs.existsSync(quarantineDir)) fs.mkdirSync(quarantineDir, { recursive: true });

      let moved = 0;
      const errors: string[] = [];
      for (const row of rows) {
        const absPath = path.isAbsolute(row.path) ? row.path : path.join(PHOTOS_PATH, row.path);
        const dest = path.join(quarantineDir, path.basename(row.path));
        try {
          fs.renameSync(absPath, dest);
          moved++;
        } catch (err) {
          errors.push(`${row.path}: ${err instanceof Error ? err.message : 'error'}`);
        }
      }

      // Remove resolved reports from integrity_reports
      if (moved > 0) {
        db.prepare(`DELETE FROM integrity_reports WHERE id IN (${ph})`).run(...ids);
      }

      return NextResponse.json({ moved, errors });
    }

    if (action === 'rescan_unindexed') {
      // Trigger a partial scan — reuse the existing scan endpoint logic
      // We return the paths so the client can display them; actual scan is triggered separately
      const items = getIntegrityReportByType('unindexed');
      return NextResponse.json({ paths: items.map(i => i.path) });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[integrity/resolve] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
