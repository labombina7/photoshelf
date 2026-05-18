import fs from 'fs/promises';
import path from 'path';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';

async function ollamaText(prompt: string, timeoutMs = 30_000): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2-vision:11b',
      prompt,
      stream: false,
      options: { temperature: 0 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.response ?? '';
}

async function ollamaVision(prompt: string, base64: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2-vision:11b',
      prompt,
      images: [base64],
      stream: false,
      options: { temperature: 0 },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.response ?? '';
}

export async function classifyPhoto(relativePath: string, photosRoot: string): Promise<string[]> {
  const absPath = path.join(photosRoot, relativePath);
  const buffer = await fs.readFile(absPath);
  const base64 = buffer.toString('base64');

  const raw = await ollamaVision(
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

export async function parseSearchQuery(prompt: string): Promise<{ year: number | null; concept: string; tags: string[] }> {
  const raw = await ollamaText(
    `Extract photo search parameters from this query. Reply with JSON only, no explanation.
Tags must only come from these exact values: "b&w", "color", portrait, landscape, street, fashion, editorial, architecture, macro, product, documentary, wildlife, travel, sport, abstract, personal, work, event, nature.
Only include tags that are explicitly required by the query — do NOT add broad style tags unless specifically mentioned.
Query: "${prompt}"
JSON format: {"year": null or number, "concept": "english concept", "tags": ["tag1", "tag2"]}
Example for "fotos de naturaleza": {"year": null, "concept": "nature", "tags": ["nature"]}
Example for "retratos en blanco y negro": {"year": null, "concept": "black and white portrait", "tags": ["b&w", "portrait"]}
Example for "fotos en blanco y negro": {"year": null, "concept": "black and white", "tags": ["b&w"]}
Example for "paisajes de viaje 2023": {"year": 2023, "concept": "travel landscapes", "tags": ["landscape", "travel"]}
JSON:`
  );

  try {
    const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
    const parsed = JSON.parse(json);
    return {
      year: parsed.year ?? null,
      concept: parsed.concept ?? prompt,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch {
    return { year: null, concept: prompt, tags: [] };
  }
}

export interface ProjectCandidate {
  id: number;
  filename: string;
  year: number;
  event: string;
  tags: string[];
}

export interface GeneratedProject {
  title: string;
  statement: string;
  selectedIds: number[];
}

export async function generateProject(
  candidates: ProjectCandidate[],
  count: number
): Promise<GeneratedProject> {
  // Shuffle so LLM doesn't pick by list position (primacy bias)
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);

  const photoList = shuffled
    .map(p => `ID:${p.id} | ${p.year}/${p.event} | tags: ${p.tags.join(', ') || 'none'}`)
    .join('\n');

  const maxPerEvent = Math.max(2, Math.ceil(count / 4));

  const raw = await ollamaText(
    `You are an experienced photography curator selecting images for a gallery exhibition.

Task: choose exactly ${count} photos from the list below to form a cohesive photographic project.

IMPORTANT: Read the ENTIRE list before making any selection. Do NOT pick photos just because they appear near the top — position in this list is random and meaningless. Your selection must be based solely on quality and fit.

Rules — follow ALL of them:
1. SCAN FIRST: Go through all ${shuffled.length} photos before deciding. The best photos may be anywhere in the list.
2. TONE: pick either all b&w or all color (whichever gives stronger results). Do not mix.
3. DIVERSITY: Do not pick more than ${maxPerEvent} photos from the same event folder. Spread across different events and years.
4. VARIETY: If two photos share the same event and similar tags, pick only one — the one with richer or more specific tags.
5. QUALITY: Strongly prefer photos with more specific tags (e.g. "portrait, editorial, studio, woman") over untagged ones or those with only generic tags.
6. NARRATIVE ARC: Order the final selectedIds to tell a visual story — opening image, development, climax, closing.

Photos (ID | year/event | tags):
${photoList}

Reply ONLY with this JSON, no explanation, no markdown:
{
  "title": "short evocative title in Spanish (3-6 words)",
  "statement": "2-3 sentences on the project theme and emotional intent, in Spanish",
  "selectedIds": [exactly ${count} photo IDs ordered narratively]
}`,
    180_000
  );

  try {
    const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
    const parsed = JSON.parse(json);
    const selectedIds: number[] = Array.isArray(parsed.selectedIds)
      ? parsed.selectedIds
          .map((id: unknown) => Number(id))
          .filter((id: number) => candidates.some(c => c.id === id))
          .slice(0, count)
      : [];
    return {
      title: parsed.title ?? 'Proyecto sin título',
      statement: parsed.statement ?? '',
      selectedIds,
    };
  } catch {
    return { title: 'Proyecto sin título', statement: '', selectedIds: [] };
  }
}

export interface PhotoReview {
  composition: string;
  light: string;
  strengths: string[];
  weaknesses: string[];
  score: number;
  summary: string;
}

export async function reviewPhoto(relativePath: string, photosRoot: string): Promise<PhotoReview> {
  const absPath = path.join(photosRoot, relativePath);
  const buffer = await fs.readFile(absPath);
  const base64 = buffer.toString('base64');

  const raw = await ollamaVision(
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

  try {
    const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
    const parsed = JSON.parse(json);
    return {
      composition: parsed.composition ?? '',
      light: parsed.light ?? '',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 3) : [],
      score: typeof parsed.score === 'number' ? Math.min(10, Math.max(1, Math.round(parsed.score))) : 0,
      summary: parsed.summary ?? '',
    };
  } catch {
    return { composition: '', light: '', strengths: [], weaknesses: [], score: 0, summary: raw.trim().slice(0, 300) };
  }
}

export async function photoMatchesConcept(
  relativePath: string,
  photosRoot: string,
  concept: string
): Promise<{ matches: boolean; tags: string[] }> {
  const absPath = path.join(photosRoot, relativePath);
  const buffer = await fs.readFile(absPath);
  const base64 = buffer.toString('base64');

  const raw = await ollamaVision(
    `Does this photo show or relate to: "${concept}"?
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
