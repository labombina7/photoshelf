import { callOllamaVision } from './client';
import { readPhotoAsJpegBase64 } from './image';
import { escapeXml } from './utils';

export async function photoMatchesConcept(
  relativePath: string,
  photosRoot: string,
  concept: string
): Promise<{ matches: boolean; tags: string[] }> {
  const base64 = await readPhotoAsJpegBase64(relativePath, photosRoot);

  const raw = await callOllamaVision(
    `Does this photo show or relate to: <user_query>${escapeXml(concept)}</user_query>?
First line: YES or NO
Second line: comma-separated tags (b&w or color, up to 2 styles from: portrait landscape street fashion editorial architecture macro product documentary wildlife travel sport abstract, one genre from: personal work travel event nature, 1-2 subject tags)
Example:
YES
color, landscape, nature, mountains, golden hour`,
    base64
  );

  const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const matches = lines[0]?.toUpperCase().startsWith('YES') ?? false;
  const tagLine = lines[1] ?? '';
  const tags = tagLine
    .split(',')
    .map((t: string) => t.trim().toLowerCase().replace(/[^a-z0-9 áéíóúñüàèìòùâêîôûäëïöü\-&]/g, ''))
    .filter((t: string) => t.length > 0 && t.length < 50)
    .slice(0, 6);

  return { matches, tags };
}
