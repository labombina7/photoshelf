import { callOllamaVision } from './client';
import { readPhotoAsJpegBase64 } from './image';
import { extractJsonObject } from './utils';

export interface PhotoReview {
  composition: string;
  light: string;
  strengths: string[];
  weaknesses: string[];
  score: number;
  summary: string;
}

export async function reviewPhoto(relativePath: string, photosRoot: string): Promise<PhotoReview> {
  const base64 = await readPhotoAsJpegBase64(relativePath, photosRoot);

  const raw = await callOllamaVision(
    `You are an expert photography critic. Analyze this photo and reply ONLY with a JSON object, no extra text.
JSON format:
{
  "composition": "one sentence about framing, rule of thirds, leading lines, balance",
  "light": "one sentence about lighting quality, direction, contrast, mood",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "score": <integer 1-10>,
  "summary": "one sentence overall verdict"
}
Be concise, specific, and honest. Reply in Spanish.`,
    base64
  );

  const json = extractJsonObject(raw);

  let parsed: Record<string, unknown> | null = null;
  const candidates = [
    json,
    json.replace(/\r?\n/g, ' '),
    json.replace(/\r?\n/g, ' ').replace(/,(\s*[}\]])/g, '$1'),
  ];
  for (const candidate of candidates) {
    try { parsed = JSON.parse(candidate); break; } catch { /* try next */ }
  }

  if (!parsed) {
    console.error('[ollama] reviewPhoto: JSON.parse failed. Raw response:\n', raw.slice(0, 500));
    return { composition: '', light: '', strengths: [], weaknesses: [], score: 0, summary: '' };
  }

  const scoreRaw = parsed.score;
  const scoreNum = typeof scoreRaw === 'number'
    ? scoreRaw
    : typeof scoreRaw === 'string' ? parseFloat(scoreRaw) : NaN;

  return {
    composition: typeof parsed.composition === 'string' ? parsed.composition : '',
    light:       typeof parsed.light === 'string'       ? parsed.light       : '',
    strengths:   Array.isArray(parsed.strengths)  ? (parsed.strengths  as string[]).slice(0, 3) : [],
    weaknesses:  Array.isArray(parsed.weaknesses) ? (parsed.weaknesses as string[]).slice(0, 3) : [],
    score:       isNaN(scoreNum) ? 0 : Math.min(10, Math.max(1, Math.round(scoreNum))),
    summary:     typeof parsed.summary === 'string' ? parsed.summary : '',
  };
}
