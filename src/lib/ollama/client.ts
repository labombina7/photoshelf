import { OLLAMA_TIMEOUT_TEXT_MS, OLLAMA_TIMEOUT_VISION_MS } from '@/lib/config';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';

export async function callOllama(prompt: string, timeoutMs = OLLAMA_TIMEOUT_TEXT_MS): Promise<string> {
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

export async function callOllamaVision(prompt: string, imageBase64: string, timeoutMs = OLLAMA_TIMEOUT_VISION_MS): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2-vision:11b',
      prompt,
      images: [imageBase64],
      stream: false,
      options: { temperature: 0 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.response ?? '';
}
