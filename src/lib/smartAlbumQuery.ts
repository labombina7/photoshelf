import { getDb } from '@/lib/db';

export type RuleField = 'year' | 'tag' | 'theme' | 'favorite' | 'camera' | 'no_tags';
export type RuleOp = 'eq' | 'gte' | 'lte' | 'contains' | 'is_true' | 'is_false' | 'is_empty';

export interface AlbumRule {
  field: RuleField;
  op: RuleOp;
  value?: string;
}

const ALLOWED_FIELDS: Set<string> = new Set(['year', 'tag', 'theme', 'favorite', 'camera', 'no_tags']);
const ALLOWED_OPS: Set<string> = new Set(['eq', 'gte', 'lte', 'contains', 'is_true', 'is_false', 'is_empty']);

function validateRules(rules: unknown[]): AlbumRule[] {
  return rules.filter((r): r is AlbumRule => {
    if (typeof r !== 'object' || r === null) return false;
    const rule = r as Record<string, unknown>;
    return (
      typeof rule.field === 'string' && ALLOWED_FIELDS.has(rule.field) &&
      typeof rule.op === 'string' && ALLOWED_OPS.has(rule.op)
    );
  });
}

export interface QueryFragments {
  joinSql: string;
  whereSql: string;
  params: (string | number)[];
}

/**
 * Translates validated album rules into safe SQL WHERE fragments using EXISTS subqueries.
 * All params are WHERE-level so they compose safely with any base query's JOIN+WHERE params.
 * No JOINs are emitted — this avoids param-ordering issues when used as an extra filter.
 */
export function buildSmartAlbumQuery(rawRules: AlbumRule[], catalogId = 1, options?: { skipCatalogFilter?: boolean }): QueryFragments {
  const rules = validateRules(rawRules);
  const whereParts: string[] = options?.skipCatalogFilter ? [] : ['p.catalog_id = ?'];
  const whereParams: (string | number)[] = options?.skipCatalogFilter ? [] : [catalogId];

  for (const rule of rules) {
    if (rule.field === 'year') {
      if (rule.op === 'eq' && rule.value) {
        whereParts.push('p.year = ?');
        whereParams.push(parseInt(rule.value, 10));
      } else if (rule.op === 'gte' && rule.value) {
        whereParts.push('p.year >= ?');
        whereParams.push(parseInt(rule.value, 10));
      } else if (rule.op === 'lte' && rule.value) {
        whereParts.push('p.year <= ?');
        whereParams.push(parseInt(rule.value, 10));
      }
    } else if (rule.field === 'tag' && rule.op === 'contains' && rule.value) {
      whereParts.push(
        'EXISTS (SELECT 1 FROM photo_tags _pt JOIN tags _t ON _t.id = _pt.tag_id WHERE _pt.photo_id = p.id AND _t.name = ?)'
      );
      whereParams.push(rule.value);
    } else if (rule.field === 'theme' && rule.op === 'eq' && rule.value) {
      whereParts.push(
        'EXISTS (SELECT 1 FROM photo_themes _pth WHERE _pth.photo_id = p.id AND _pth.theme_id = ?)'
      );
      whereParams.push(parseInt(rule.value, 10));
    } else if (rule.field === 'favorite') {
      if (rule.op === 'is_true')  whereParts.push('p.is_favorite = 1');
      if (rule.op === 'is_false') whereParts.push('p.is_favorite = 0');
    } else if (rule.field === 'camera' && rule.op === 'contains' && rule.value) {
      whereParts.push('p.camera LIKE ?');
      whereParams.push(`%${rule.value}%`);
    } else if (rule.field === 'no_tags' && rule.op === 'is_empty') {
      whereParts.push('NOT EXISTS (SELECT 1 FROM photo_tags _ptno WHERE _ptno.photo_id = p.id)');
    }
  }

  return {
    joinSql:  '',
    whereSql: whereParts.map(c => `AND ${c}`).join('\n  '),
    params:   whereParams,
  };
}

export function countSmartAlbumPhotos(rules: AlbumRule[], catalogId = 1): number {
  const db = getDb();
  const { whereSql, params } = buildSmartAlbumQuery(rules, catalogId);
  const row = db.prepare(`
    SELECT COUNT(DISTINCT p.id) as c
    FROM photos p
    WHERE 1=1
    ${whereSql}
  `).get(...params) as { c: number };
  return row.c;
}

export function rulesFromJson(json: string): AlbumRule[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return validateRules(parsed);
  } catch {
    return [];
  }
}

/** Human-readable summary of rules for display in the album list. */
export function describeRules(rules: AlbumRule[]): string {
  const parts: string[] = [];
  for (const rule of rules) {
    if (rule.field === 'year') {
      if (rule.op === 'eq') parts.push(`Año ${rule.value}`);
      else if (rule.op === 'gte') parts.push(`Desde ${rule.value}`);
      else if (rule.op === 'lte') parts.push(`Hasta ${rule.value}`);
    } else if (rule.field === 'tag') {
      parts.push(`Tag: ${rule.value}`);
    } else if (rule.field === 'theme') {
      parts.push(`Temática: ${rule.value}`);
    } else if (rule.field === 'favorite') {
      parts.push(rule.op === 'is_true' ? 'Favoritas' : 'No favoritas');
    } else if (rule.field === 'camera') {
      parts.push(`Cámara: ${rule.value}`);
    } else if (rule.field === 'no_tags') {
      parts.push('Sin tags');
    }
  }
  return parts.length > 0 ? parts.join(' · ') : 'Sin filtros';
}
