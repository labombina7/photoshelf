import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const CACHE_PATH = process.env.CACHE_PATH ?? path.join(process.cwd(), 'data', '.cache');
const DEFAULT_SIZE = 400;

export async function getThumbnail(
  relativePath: string,
  photosRoot: string,
  size = DEFAULT_SIZE
): Promise<{ buffer: Buffer; contentType: string }> {
  const cacheKey = crypto
    .createHash('md5')
    .update(`${relativePath}:${size}`)
    .digest('hex');
  const cachePath = path.join(CACHE_PATH, `${cacheKey}.webp`);

  // Serve from cache if available
  try {
    const buffer = await fs.readFile(cachePath);
    return { buffer, contentType: 'image/webp' };
  } catch {}

  // Generate thumbnail
  await fs.mkdir(CACHE_PATH, { recursive: true });

  const absPath = path.join(photosRoot, relativePath);
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
  const buffer = await sharp(inputBuffer)
    .resize(size, size, { fit: 'cover', position: 'attention' })
    .webp({ quality: 80 })
    .toBuffer();

  await fs.writeFile(cachePath, buffer);
  return { buffer, contentType: 'image/webp' };
}
