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
      prompt: `Analyze this photo and reply with ONLY comma-separated tags in this exact order:
1. "b&w" or "color"
2. Up to 2 photography styles from this list: portrait, landscape, street, fashion, editorial, architecture, macro, product, documentary, wildlife, travel, sport, abstract
3. One genre from this list: personal, work, travel, event, nature
4. 1 or 2 specific tags about the main subject or mood

No explanations. No numbering. No extra words. Maximum 6 tags total.
Example: color, portrait, editorial, work, studio, woman`,
      images: [base64],
      stream: false,
      options: { temperature: 0 },
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
    .map((t: string) => t.trim().toLowerCase().replace(/[^a-z0-9 áéíóúñüàèìòùâêîôûäëïöü\-&]/g, ''))
    .filter((t: string) => t.length > 0 && t.length < 50)
    .slice(0, 6);
}
