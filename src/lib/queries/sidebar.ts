import { getDb, getSidebarProjects } from '@/lib/db';
import { listThemes } from './themes';
import { listCatalogs } from './catalogs';
import type { ThemeWithCount } from './themes';
import type { CatalogRow } from './catalogs';

export interface SidebarData {
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  themes: ThemeWithCount[];
  projects: { id: number; title: string }[];
  catalogs: CatalogRow[];
}

/**
 * Returns all data needed to render the Sidebar + page layout.
 *
 * Replaces the block of 4–5 identical queries that previously appeared at the
 * top of every Server Component page.
 */
export function getSidebarData(catalogId = 1): SidebarData {
  const db = getDb();

  const totalPhotos   = (db.prepare('SELECT COUNT(*) as c FROM photos WHERE catalog_id = ?').get(catalogId) as { c: number }).c;
  const favoriteCount = (db.prepare('SELECT COUNT(*) as c FROM photos WHERE is_favorite = 1 AND catalog_id = ?').get(catalogId) as { c: number }).c;
  const untaggedCount = (db.prepare(`
    SELECT COUNT(*) as c FROM photos p
    WHERE catalog_id = ?
    AND NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id)
  `).get(catalogId) as { c: number }).c;

  const themes   = listThemes(catalogId);
  const projects = getSidebarProjects(db);
  const catalogs = listCatalogs();

  return { totalPhotos, favoriteCount, untaggedCount, themes, projects, catalogs };
}
