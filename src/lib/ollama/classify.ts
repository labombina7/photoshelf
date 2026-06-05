import { callOllamaVision } from './client';
import { readPhotoAsJpegBase64, detectIsBlackAndWhite } from './image';

export async function classifyPhoto(relativePath: string, photosRoot: string): Promise<string[]> {
  const [base64, isBW] = await Promise.all([
    readPhotoAsJpegBase64(relativePath, photosRoot),
    detectIsBlackAndWhite(relativePath, photosRoot),
  ]);

  const raw = await callOllamaVision(
    `Look at this photo and reply with ONLY a comma-separated list of 3 to 5 tags in English.

Tags should describe:
- The main subject (person, mountain, dog, building, food...)
- The setting or context (indoor, outdoor, beach, city, forest, studio...)
- The mood or moment if distinctive (celebration, sunset, sport, night...)

Rules:
- Lowercase only
- No generic words like "photo", "image", "picture"
- No colors
- Be specific, not abstract
- Only real visible content, no guesses

Reply with tags only, nothing else.
Example: portrait, outdoor, elderly man, park, autumn`,
    base64
  );

  const aiTags = raw
    .split(',')
    .map((t: string) => t.trim().toLowerCase().replace(/[^a-z0-9 áéíóúñüàèìòùâêîôûäëïöü\-&]/g, ''))
    .filter((t: string) => t.length > 0 && t.length < 50)
    .slice(0, 5);

  return [isBW ? 'b&w' : 'color', ...aiTags];
}
