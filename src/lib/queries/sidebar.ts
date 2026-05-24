import { getDb, getSidebarProjects } from '@/lib/db';
import { listThemes } from './themes';
import type { ThemeWithCount } from './themes';

export interface SidebarData {
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  themes: ThemeWithCount[];
  projects: { id: number; title: string }[];
}

/**
 * Returns all data needed to render the Sidebar + page layout.
 *
 * Replaces the block of 4–5 identical queries that previously appeared at the
 * top of every Server Component page.
 */
export function getSidebarData(): SidebarData {
  const db = getDb();

  const totalPhotos   = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;
  const favoriteCount = (db.prepare('SELECT COUNT(*) as c FROM photos WHERE is_favorite = 1').get() as { c: number }).c;
  const untaggedCount = (db.prepare(`
    SELECT COUNT(*) as c FROM photos p
    WHERE NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id)
  `).get() as { c: number }).c;

  const themes   = listThemes();
  const projects = getSidebarProjects(db);

  return { totalPhotos, favoriteCount, untaggedCount, themes, projects };
}
