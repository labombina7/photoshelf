import { getDb } from '@/lib/db';
import { buildPhotoFilter } from '@/lib/db-helpers';
import type { PhotoFilters } from '@/lib/db-helpers';

export type { PhotoFilters };

export interface EventGroupRow {
  year: number;
  event: string;
  count: number;
  /** ID of one photo in the group — used to render a folder thumbnail. */
  thumbnail_id: number;
}

export interface GroupListResult {
  groups: EventGroupRow[];
  total: number;
}

export function listGroups(filters: PhotoFilters, catalogId = 1): GroupListResult {
  const db = getDb();
  const { joinSql, whereSql, params: fp } = buildPhotoFilter({ ...filters, catalogId });

  const groups = db.prepare(`
    SELECT p.year, p.event, COUNT(DISTINCT p.id) as count, MIN(p.id) as thumbnail_id
    FROM photos p
    ${joinSql}
    WHERE 1=1
    ${whereSql}
    GROUP BY p.year, p.event ORDER BY p.year DESC, p.event ASC
  `).all(...fp) as EventGroupRow[];

  const total = groups.reduce((sum, g) => sum + g.count, 0);
  return { groups, total };
}
