import fs from 'fs/promises';
import path from 'path';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';

export async function classifyPhoto(relativePath: string, photosRoot: string): Promise<string[]> {
  const absPath = path.join(photosRoot, relativePath);
  const buffer = await fs.readFile(absPath);
  const base64 = buffer.toString('base64');

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2-vision:11b',
      prompt: `Analyze this photo and respond with ONLY a comma-separated list of descriptive tags in English.
Focus on: subjects (people, animals, objects), setting (beach, city, forest, restaurant, indoors),
mood or event (celebration, peaceful, action, portrait), and any notable elements.
Maximum 8 short tags. No explanations, no numbering, no bullets.
Example: travel, architecture, Japan, temple, cherry blossoms, spring`,
      images: [base64],
      stream: false,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }

  const data = await response.json();
  const raw: string = data.response ?? '';

  return raw
    .split(',')
    .map((t: string) => t.trim().toLowerCase().replace(/[^a-z0-9 áéíóúñüàèìòùâêîôûäëïöü\-]/g, ''))
    .filter((t: string) => t.length > 0 && t.length < 50)
    .slice(0, 8);
}
