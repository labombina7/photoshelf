import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getIntegrityState, updateIntegrityState } from './integrityState';
import {
  clearIntegrityReports,
  insertIntegrityReport,
  getAllPhotoPaths,
  getIndexedPathsSet,
  getAllPhotosWithCatalogPath,
} from './queries/integrity';
import { PHOTOS_PATH } from './config';
import { CACHE_PATH } from './thumbnail';

const THUMBNAIL_VARIANTS: Array<{ size: number; fit: 'cover' | 'inside' }> = [
  { size: 200, fit: 'cover' },
  { size: 400, fit: 'cover' },
  { size: 400, fit: 'inside' },
  { size: 800, fit: 'inside' },
];

const PHOTO_EXTS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.webp', '.tif', '.tiff', '.avif', '.gif']);

// Directories to skip — Synology NAS metadata, macOS internals, quarantine folder
const SKIP_DIRS = new Set(['@eaDir', '@Recently-Snapshot', '#recycle', '.@__thumb', '@tmp', '.DS_Store', '_quarantine']);

// ── Walk disk recursively, yield photo file paths ────────────────────────────

function walkDir(dir: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...walkDir(full));
    } else if (e.isFile() && PHOTO_EXTS.has(path.extname(e.name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

// ── Phase 3: verify image header via sharp ────────────────────────────────────

async function isCorrupt(filePath: string): Promise<string | null> {
  try {
    // Dynamic import so sharp is only loaded when needed
    const sharp = (await import('sharp')).default;
    await sharp(filePath).metadata();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Unknown error';
  }
}

// ── Main scanner ──────────────────────────────────────────────────────────────

export async function runIntegrityScan(includeCorrupt = false): Promise<void> {
  if (getIntegrityState().running) return;

  updateIntegrityState({
    running: true,
    phase: 'orphans',
    checked: 0,
    total: 0,
    orphansFound: 0,
    unindexedFound: 0,
    corruptFound: 0,
    orphanThumbnailsFound: 0,
    error: null,
    completedAt: null,
  });

  try {
    clearIntegrityReports();

    // ── Phase 1: orphans in DB ────────────────────────────────────────────────
    const dbPhotos = getAllPhotoPaths();
    updateIntegrityState({ phase: 'orphans', total: dbPhotos.length });

    let orphans = 0;
    for (let i = 0; i < dbPhotos.length; i++) {
      const { id, path: relPath } = dbPhotos[i];
      const absPath = path.isAbsolute(relPath) ? relPath : path.join(PHOTOS_PATH, relPath);
      if (!fs.existsSync(absPath)) {
        insertIntegrityReport('orphan', relPath, id);
        orphans++;
      }
      updateIntegrityState({ checked: i + 1, orphansFound: orphans });
    }

    // ── Phase 2: unindexed on disk ────────────────────────────────────────────
    updateIntegrityState({ phase: 'unindexed', checked: 0 });

    const diskFiles = walkDir(PHOTOS_PATH);
    const indexedPaths = getIndexedPathsSet();

    let unindexed = 0;
    for (let i = 0; i < diskFiles.length; i++) {
      const absPath = diskFiles[i];
      const relPath = path.relative(PHOTOS_PATH, absPath);
      if (!indexedPaths.has(relPath) && !indexedPaths.has(absPath)) {
        insertIntegrityReport('unindexed', relPath);
        unindexed++;
      }
      updateIntegrityState({ checked: i + 1, total: diskFiles.length, unindexedFound: unindexed });
    }

    // ── Phase 3: corrupt headers (optional) ──────────────────────────────────
    if (includeCorrupt) {
      updateIntegrityState({ phase: 'corrupt', checked: 0, total: diskFiles.length });

      let corrupt = 0;
      const BATCH = 100;
      for (let i = 0; i < diskFiles.length; i += BATCH) {
        const batch = diskFiles.slice(i, i + BATCH);
        for (const absPath of batch) {
          const errorMsg = await isCorrupt(absPath);
          if (errorMsg) {
            insertIntegrityReport('corrupt', path.relative(PHOTOS_PATH, absPath), undefined, errorMsg);
            corrupt++;
          }
        }
        updateIntegrityState({ checked: i + batch.length, corruptFound: corrupt });
        // Yield to event loop between batches
        await new Promise(r => setImmediate(r));
      }
    }

    // ── Phase 4: orphan thumbnails in cache ───────────────────────────────────
    updateIntegrityState({ phase: 'orphan_thumbnails', checked: 0, total: 0 });

    let cacheFiles: string[] = [];
    try {
      cacheFiles = fs.readdirSync(CACHE_PATH).filter(f => f.endsWith('.webp'));
    } catch { /* cache dir doesn't exist yet */ }

    if (cacheFiles.length > 0) {
      // Build set of all valid cache keys from indexed photos
      const allPhotos = getAllPhotosWithCatalogPath();
      const validKeys = new Set<string>();
      for (const photo of allPhotos) {
        for (const { size, fit } of THUMBNAIL_VARIANTS) {
          const key = crypto.createHash('md5')
            .update(`${photo.catalog_path}:${photo.path}:${size}:${fit}`)
            .digest('hex');
          validKeys.add(key);
        }
      }

      let orphanThumbs = 0;
      for (let i = 0; i < cacheFiles.length; i++) {
        const file = cacheFiles[i];
        const key = file.replace(/\.webp$/, '');
        if (!validKeys.has(key)) {
          insertIntegrityReport('orphan_thumbnail', path.join(CACHE_PATH, file));
          orphanThumbs++;
        }
        updateIntegrityState({ checked: i + 1, total: cacheFiles.length, orphanThumbnailsFound: orphanThumbs });
      }
    }

    updateIntegrityState({
      running: false,
      phase: 'done',
      completedAt: Date.now(),
    });
  } catch (err) {
    updateIntegrityState({
      running: false,
      phase: 'idle',
      error: err instanceof Error ? err.message : 'Unknown error',
      completedAt: Date.now(),
    });
  }
}
