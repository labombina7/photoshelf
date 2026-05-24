import { getDb } from '@/lib/db';

export interface CatalogRow {
  id: number;
  name: string;
  path: string;
  created_at: number;
  photo_count: number;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function listCatalogs(): CatalogRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT c.id, c.name, c.path, c.created_at,
           COUNT(p.id) as photo_count
    FROM catalogs c
    LEFT JOIN photos p ON p.catalog_id = c.id
    GROUP BY c.id
    ORDER BY c.id ASC
  `).all() as CatalogRow[];
}

export function getCatalogById(id: number): CatalogRow | null {
  return (getDb().prepare(
    'SELECT c.*, (SELECT COUNT(*) FROM photos p WHERE p.catalog_id = c.id) as photo_count FROM catalogs c WHERE c.id = ?'
  ).get(id) as CatalogRow | undefined) ?? null;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export interface CreateCatalogInput {
  name: string;
  path: string;
}

export function createCatalog(input: CreateCatalogInput): CatalogRow {
  const { name, path } = input;

  // Validate no overlapping paths
  const existing = listCatalogs();
  for (const cat of existing) {
    if (cat.path === path) {
      throw new Error(`Ya existe un catálogo con la ruta "${path}"`);
    }
    if (path.startsWith(cat.path + '/') || cat.path.startsWith(path + '/')) {
      throw new Error(`La ruta "${path}" se solapa con el catálogo "${cat.name}" (${cat.path})`);
    }
  }

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO catalogs (name, path) VALUES (?, ?)'
  ).run(name.trim(), path.trim());

  const created = getCatalogById(result.lastInsertRowid as number);
  return created
    ? { ...created, photo_count: 0 }
    : { id: result.lastInsertRowid as number, name: name.trim(), path: path.trim(), created_at: Math.floor(Date.now() / 1000), photo_count: 0 };
}

export function renameCatalog(id: number, name: string): CatalogRow {
  const db = getDb();
  const catalog = getCatalogById(id);
  if (!catalog) throw new Error(`Catálogo ${id} no encontrado`);

  db.prepare('UPDATE catalogs SET name = ? WHERE id = ?').run(name.trim(), id);
  return { ...catalog, name: name.trim() };
}

export function deleteCatalog(id: number): void {
  if (id === 1) throw new Error('No se puede eliminar el catálogo Principal');

  const db = getDb();
  const catalog = getCatalogById(id);
  if (!catalog) throw new Error(`Catálogo ${id} no encontrado`);

  // Delete photos in this catalog (cascade handles tags/themes)
  db.prepare('DELETE FROM photos WHERE catalog_id = ?').run(id);
  db.prepare('DELETE FROM catalogs WHERE id = ?').run(id);
}
