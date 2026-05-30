import { callOllamaVision } from './client';
import { readPhotoAsJpegBase64 } from './image';

export async function classifyPhoto(relativePath: string, photosRoot: string): Promise<string[]> {
  const base64 = await readPhotoAsJpegBase64(relativePath, photosRoot);

  const raw = await callOllamaVision(
    `Analyze this photo and reply with ONLY comma-separated tags in this exact order:
1. "b&w" or "color"
2. Up to 2 photography styles from this list: portrait, landscape, street, fashion, editorial, architecture, macro, product, documentary, wildlife, travel, sport, abstract
3. One genre from this list: personal, work, travel, event, nature
4. 1 or 2 specific tags about the main subject or mood

No explanations. No numbering. No extra words. Maximum 6 tags total.
Example: color, portrait, editorial, work, studio, woman`,
    base64
  );

  return raw
    .split(',')
    .map((t: string) => t.trim().toLowerCase().replace(/[^a-z0-9 áéíóúñüàèìòùâêîôûäëïöü\-&]/g, ''))
    .filter((t: string) => t.length > 0 && t.length < 50)
    .slice(0, 6);
}
