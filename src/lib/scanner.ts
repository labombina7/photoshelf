import fs from 'fs/promises';
import path from 'path';
import { getDb } from './db';

const PHOTO_EXTS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.webp', '.tif', '.tiff']);

interface ScannedPhoto {
  path: string;      // relative to photosRoot
  filename: string;
  year: number;
  event: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  taken_at: string | null;
  camera: string | null;
  exposure: string | null;
  gps_lat: number | null;
  gps_lon: number | null;
}

type ProgressCallback = (event: string, done: number, total: number) => void;

export async function scanLibrary(
  photosRoot: string,
  onProgress?: ProgressCallback
): Promise<{ added: number; total: number }> {
  const db = getDb();

  const upsert = db.prepare(`
    INSERT INTO photos
      (path, filename, year, event, size_bytes, width, height,
       taken_at, camera, exposure, gps_lat, gps_lon, scanned_at)
    VALUES
      (@path, @filename, @year, @event, @size_bytes, @width, @height,
       @taken_at, @camera, @exposure, @gps_lat, @gps_lon, datetime('now'))
    ON CONFLICT(path) DO UPDATE SET
      scanned_at = excluded.scanned_at,
      size_bytes = excluded.size_bytes,
      width      = COALESCE(photos.width, excluded.width),
      height     = COALESCE(photos.height, excluded.height),
      taken_at   = COALESCE(photos.taken_at, excluded.taken_at),
      camera     = COALESCE(photos.camera, excluded.camera),
      exposure   = COALESCE(photos.exposure, excluded.exposure),
      gps_lat    = COALESCE(photos.gps_lat, excluded.gps_lat),
      gps_lon    = COALESCE(photos.gps_lon, excluded.gps_lon)
  `);

  const insertBatch = db.transaction((items: ScannedPhoto[]) => {
    for (const p of items) upsert.run(p);
  });

  const countBefore: number = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;

  const totalEvents = await countEvents(photosRoot);
  await walkPhotosPerYear(photosRoot, insertBatch, totalEvents, onProgress);

  const total: number = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;
  return { added: total - countBefore, total };
}

async function countEvents(photosRoot: string): Promise<number> {
  let count = 0;
  const yearDirs = await fs.readdir(photosRoot).catch(() => [] as string[]);
  for (const yearDir of yearDirs) {
    if (isNaN(parseInt(yearDir, 10))) continue;
    const yearPath = path.join(photosRoot, yearDir);
    const stat = await fs.stat(yearPath).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const events = await fs.readdir(yearPath).catch(() => [] as string[]);
    for (const ev of events) {
      const evStat = await fs.stat(path.join(yearPath, ev)).catch(() => null);
      if (evStat?.isDirectory()) count++;
    }
  }
  return count;
}

async function walkPhotosPerYear(
  photosRoot: string,
  commit: (items: ScannedPhoto[]) => void,
  totalEvents: number,
  onProgress?: ProgressCallback
): Promise<void> {
  let yearDirs: string[];
  try {
    yearDirs = await fs.readdir(photosRoot);
  } catch {
    return;
  }

  yearDirs.sort();
  let done = 0;

  for (const yearDir of yearDirs) {
    const year = parseInt(yearDir, 10);
    if (isNaN(year)) continue;

    const yearPath = path.join(photosRoot, yearDir);
    const yearStat = await fs.stat(yearPath).catch(() => null);
    if (!yearStat?.isDirectory()) continue;

    const events = await fs.readdir(yearPath).catch(() => [] as string[]);

    for (const eventDir of events) {
      const eventPath = path.join(yearPath, eventDir);
      const eventStat = await fs.stat(eventPath).catch(() => null);
      if (!eventStat?.isDirectory()) continue;

      onProgress?.(eventDir, done, totalEvents);

      const eventPhotos: ScannedPhoto[] = [];
      const files = await fs.readdir(eventPath).catch(() => [] as string[]);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!PHOTO_EXTS.has(ext)) continue;

        const absPath = path.join(eventPath, file);
        const stat = await fs.stat(absPath).catch(() => null);
        if (!stat?.isFile()) continue;

        const relativePath = path.join(yearDir, eventDir, file);
        const exifData = await extractExif(absPath);

        eventPhotos.push({
          path: relativePath,
          filename: file,
          year,
          event: eventDir,
          size_bytes: stat.size,
          ...exifData,
        });
      }

      if (eventPhotos.length > 0) commit(eventPhotos);
      done++;
      onProgress?.(eventDir, done, totalEvents);
      console.log(`[scan] ${yearDir}/${eventDir}: ${eventPhotos.length} photos`);
    }
  }
}

async function extractExif(filePath: string): Promise<{
  width: number | null;
  height: number | null;
  taken_at: string | null;
  camera: string | null;
  exposure: string | null;
  gps_lat: number | null;
  gps_lon: number | null;
}> {
  try {
    const exifr = await import('exifr');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await (exifr.parse as any)(filePath, {
      tiff: true,
      exif: true,
      gps: true,
      ifd0: true,
    });

    if (!data) return emptyExif();

    const camera =
      [data.Make, data.Model].filter(Boolean).join(' ').trim() || null;

    let exposure: string | null = null;
    const parts: string[] = [];
    if (data.ExposureTime) {
      const et = data.ExposureTime;
      parts.push(et < 1 ? `1/${Math.round(1 / et)}` : `${et}s`);
    }
    if (data.FNumber) parts.push(`f/${data.FNumber}`);
    if (data.ISO) parts.push(`ISO ${data.ISO}`);
    if (parts.length) exposure = parts.join(' · ');

    const taken_at = data.DateTimeOriginal
      ? new Date(data.DateTimeOriginal).toISOString()
      : null;

    return {
      width: data.ImageWidth ?? data.ExifImageWidth ?? null,
      height: data.ImageHeight ?? data.ExifImageHeight ?? null,
      taken_at,
      camera,
      exposure,
      gps_lat: data.latitude ?? null,
      gps_lon: data.longitude ?? null,
    };
  } catch {
    return emptyExif();
  }
}

function emptyExif() {
  return {
    width: null, height: null,
    taken_at: null, camera: null,
    exposure: null, gps_lat: null, gps_lon: null,
  };
}
