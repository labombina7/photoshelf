import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';

export interface StructureAnalysis {
  structured: boolean;
  totalFolders: number;
  yearFolders: number;
  unstructuredRatio: number;
}

export function analyzeCatalogStructure(catalogPath: string, catalogId: number): StructureAnalysis {
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(catalogPath).filter(e => {
      try {
        return fs.statSync(path.join(catalogPath, e)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return { structured: false, totalFolders: 0, yearFolders: 0, unstructuredRatio: 1 };
  }

  const totalFolders = entries.length;
  if (totalFolders === 0) {
    // No folders at root — check if catalog has any indexed photos
    const row = getDb().prepare(
      'SELECT COUNT(*) as n FROM photos WHERE catalog_id = ?'
    ).get(catalogId) as { n: number };
    return { structured: row.n === 0, totalFolders: 0, yearFolders: 0, unstructuredRatio: row.n > 0 ? 1 : 0 };
  }

  const yearFolders = entries.filter(e => {
    const n = parseInt(e, 10);
    return !isNaN(n) && n >= 1900 && n <= 2100 && String(n) === e;
  }).length;

  const unstructuredRatio = 1 - yearFolders / totalFolders;
  const structured = unstructuredRatio < 0.5;

  return { structured, totalFolders, yearFolders, unstructuredRatio };
}
