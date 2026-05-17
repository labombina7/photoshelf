import fs from 'fs/promises';
import path from 'path';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';

async function ollamaText(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2-vision:11b',
      prompt,
      stream: false,
      options: { temperature: 0 },
    }),
    signal: AbortSignal.timeout(30_000),
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
