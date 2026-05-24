import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { resolvePhotoPath } from './config';

const CACHE_PATH = process.env.CACHE_PATH ?? path.join(process.cwd(), 'data', '.cache');
const DEFAULT_SIZE = 400;

export async function getThumbnail(
  relativePath: string,
  photosRoot: string,
  size = DEFAULT_SIZE,
  fit: 'cover' | 'inside' = 'cover'
): Promise<{ buffer: Buffer; contentType: string }> {
  // Include photosRoot in the key so two catalogs with an identical relative
  // path don't collide in the cache (they point to different files).
  const cacheKey = crypto
    .createHash('md5')
    .update(`${photosRoot}:${relativePath}:${size}:${fit}`)
    .digest('hex');
  const cachePath = path.join(CACHE_PATH, `${cacheKey}.webp`);

  // Serve from cache if available
  try {
    const buffer = await fs.readFile(cachePath);
    return { buffer, contentType: 'image/webp' };
  } catch {}

  // Generate thumbnail
  await fs.mkdir(CACHE_PATH, { recursive: true });

  // Validate path is within photosRoot (path traversal protection)
  const absPath = resolvePhotoPath(relativePath, photosRoot);
  const ext = path.extname(relativePath).toLowerCase();

  let inputBuffer: Buffer;
  if (ext === '.heic') {
    const raw = await fs.readFile(absPath);
    const heicConvert = (await import('heic-convert')).default;
    inputBuffer = Buffer.from(
      await heicConvert({ buffer: raw as unknown as ArrayBuffer, format: 'JPEG', quality: 0.9 })
    );
  } else {
    inputBuffer = await fs.readFile(absPath);
  }

  const sharp = (await import('sharp')).default;
  const resizeOptions = fit === 'inside'
    ? { width: size, height: size, fit: 'inside' as const }
    : { width: size, height: size, fit: 'cover' as const, position: 'attention' as const };

  const buffer = await sharp(inputBuffer)
    .rotate() // honour EXIF orientation
    .resize(resizeOptions)
    .webp({ quality: 80 })
    .toBuffer();

  await fs.writeFile(cachePath, buffer);
  return { buffer, contentType: 'image/webp' };
}
