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
 * Detects if a photo is black & white by counting the ratio of "clearly colored" pixels.
 *
 * Why ratio instead of mean saturation:
 * - B&w film scans often carry a warm/cool cast → mean saturation 0.08–0.15, which
 *   fooled the old threshold (< 0.08). The cast is uniform and low, so very few
 *   pixels actually exceed a "visible color" level.
 * - Desaturated color photos have many pixels with moderate saturation → ratio stays high.
 *
 * A pixel is "colored" if its HSL saturation > COLORED_SAT (0.18).
 * If fewer than COLORED_RATIO (4 %) of pixels are colored → b&w.
 */
export async function detectIsBlackAndWhite(relativePath: string, photosRoot: string): Promise<boolean> {
  const absPath = resolvePhotoPath(relativePath, photosRoot);

  const { data, info } = await sharp(absPath)
    .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = info.width * info.height;
  const COLORED_SAT   = 0.18; // saturation above this = visibly colored pixel
  const COLORED_RATIO = 0.04; // if < 4 % of pixels are colored → b&w

  let coloredPixels = 0;

  for (let i = 0; i < data.length; i += 3) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    if (delta === 0) continue; // pure grey — skip

    const l = (max + min) / 2;
    const s = delta / (1 - Math.abs(2 * l - 1));

    if (s > COLORED_SAT) coloredPixels++;
  }

  return (coloredPixels / pixels) < COLORED_RATIO;
}
