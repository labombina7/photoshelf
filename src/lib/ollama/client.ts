import { OLLAMA_TIMEOUT_TEXT_MS, OLLAMA_TIMEOUT_VISION_MS } from '@/lib/config';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';

export function isTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === 'TimeoutError' || err.name === 'AbortError' || err.message.includes('timed out');
}

async function checkOllamaResponse(res: Response): Promise<void> {
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? body.message ?? JSON.stringify(body);
    } catch {
      try { detail = await res.text(); } catch { /* ignore */ }
    }
    throw new Error(`Ollama error ${res.status}${detail ? `: ${detail}` : ''}`);
  }
}

function enrichFetchError(err: unknown): Error {
  if (!(err instanceof TypeError) || err.message !== 'fetch failed') return err instanceof Error ? err : new Error(String(err));
  const cause = (err as TypeError & { cause?: unknown }).cause;
  const detail = cause instanceof Error ? cause.message : cause ? String(cause) : 'unknown';
  return new Error(`fetch failed: ${detail}`, { cause });
}

export async function callOllama(prompt: string, timeoutMs = OLLAMA_TIMEOUT_TEXT_MS): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llava:7b',
        prompt,
        stream: false,
        options: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw enrichFetchError(err);
  }
  await checkOllamaResponse(res);
  const data = await res.json();
  return data.response ?? '';
}

export async function callOllamaVision(prompt: string, imageBase64: string, timeoutMs = OLLAMA_TIMEOUT_VISION_MS): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llava:7b',
        prompt,
        images: [imageBase64],
        stream: false,
        options: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw enrichFetchError(err);
  }
  await checkOllamaResponse(res);
  const data = await res.json();
  return data.response ?? '';
}
