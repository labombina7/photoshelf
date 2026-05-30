import sharp from 'sharp';
import { resolvePhotoPath, OLLAMA_IMAGE_SIZE } from '@/lib/config';

/**
 * Read any photo format and return a JPEG base64 string ≤OLLAMA_IMAGE_SIZE px.
 * sharp handles JPEG, PNG, WEBP, HEIC, TIFF.
 * Resizing reduces payload size and speeds up Ollama significantly.
 */
export async function readPhotoAsJpegBase64(relativePath: string, photosRoot: string): Promise<string> {
  const absPath = resolvePhotoPath(relativePath, photosRoot);
  const jpegBuffer = await sharp(absPath)
    .resize(OLLAMA_IMAGE_SIZE, OLLAMA_IMAGE_SIZE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  return jpegBuffer.toString('base64');
}
