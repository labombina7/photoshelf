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
 * Translates validated album rules into safe SQL fragments.
 * Uses a whitelist of fields and bind parameters — no string interpolation of user data.
 */
export function buildSmartAlbumQuery(rawRules: AlbumRule[], catalogId = 1, options?: { skipCatalogFilter?: boolean }): QueryFragments {
  const rules = validateRules(rawRules);
  const joinParts: string[] = [];
  const joinParams: (string | number)[] = [];
  const whereParts: string[] = options?.skipCatalogFilter ? [] : ['p.catalog_id = ?'];
  const whereParams: (string | number)[] = options?.skipCatalogFilter ? [] : [catalogId];

  let tagJoinIdx = 0;
  let themeJoinIdx = 0;

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
      const alias = `_ptag${tagJoinIdx}`;
      const talias = `_ttag${tagJoinIdx}`;
      joinParts.push(
        `JOIN photo_tags ${alias} ON ${alias}.photo_id = p.id` +
        ` JOIN tags ${talias} ON ${talias}.id = ${alias}.tag_id AND ${talias}.name = ?`
      );
      joinParams.push(rule.value);
      tagJoinIdx++;
    } else if (rule.field === 'theme' && rule.op === 'eq' && rule.value) {
      const alias = `_pth${themeJoinIdx}`;
      joinParts.push(`JOIN photo_themes ${alias} ON ${alias}.photo_id = p.id AND ${alias}.theme_id = ?`);
      joinParams.push(parseInt(rule.value, 10));
      themeJoinIdx++;
    } else if (rule.field === 'favorite') {
      if (rule.op === 'is_true') {
        whereParts.push('p.is_favorite = 1');
      } else if (rule.op === 'is_false') {
        whereParts.push('p.is_favorite = 0');
      }
    } else if (rule.field === 'camera' && rule.op === 'contains' && rule.value) {
      whereParts.push('p.camera LIKE ?');
      whereParams.push(`%${rule.value}%`);
    } else if (rule.field === 'no_tags' && rule.op === 'is_empty') {
      joinParts.push('LEFT JOIN photo_tags _ptno ON _ptno.photo_id = p.id');
      whereParts.push('_ptno.photo_id IS NULL');
    }
  }

  return {
    joinSql:  joinParts.join('\n  '),
    whereSql: whereParts.map(c => `AND ${c}`).join('\n  '),
    params:   [...joinParams, ...whereParams],
  };
}

export function countSmartAlbumPhotos(rules: AlbumRule[], catalogId = 1): number {
  const db = getDb();
  const { joinSql, whereSql, params } = buildSmartAlbumQuery(rules, catalogId);
  const row = db.prepare(`
    SELECT COUNT(DISTINCT p.id) as c
    FROM photos p
    ${joinSql}
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
