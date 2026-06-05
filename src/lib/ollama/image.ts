import sharp from 'sharp';
import { resolvePhotoPath, OLLAMA_IMAGE_SIZE } from '@/lib/config';

export async function readPhotoAsJpegBase64(relativePath: string, photosRoot: string): Promise<string> {
  const absPath = resolvePhotoPath(relativePath, photosRoot);
  const jpegBuffer = await sharp(absPath)
    .resize(OLLAMA_IMAGE_SIZE, OLLAMA_IMAGE_SIZE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  return jpegBuffer.toString('base64');
}

/**
 * Detects if a photo is black & white by analyzing mean saturation.
 * Converts to HSL and checks if average saturation is below threshold.
 * Much more reliable than asking a vision model.
 */
export async function detectIsBlackAndWhite(relativePath: string, photosRoot: string): Promise<boolean> {
  const absPath = resolvePhotoPath(relativePath, photosRoot);

  // Sample a small version for speed
  const { data, info } = await sharp(absPath)
    .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = info.width * info.height;
  let totalSaturation = 0;

  for (let i = 0; i < data.length; i += 3) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    // HSL saturation
    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    totalSaturation += s;
  }

  const avgSaturation = totalSaturation / pixels;
  // Photos with avg saturation < 0.08 are considered b&w
  return avgSaturation < 0.08;
}
