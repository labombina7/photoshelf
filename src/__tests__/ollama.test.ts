import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractJsonObject } from '@/lib/ollama/utils';

// Only fetch and sharp are mocked — all parsing logic runs from the real module.
// The mock covers the full production chain: resize/jpeg/toBuffer (readPhotoAsJpegBase64)
// and resize/removeAlpha/raw/toBuffer({ resolveWithObject }) (detectIsBlackAndWhite).
const sharpState = vi.hoisted(() => {
  const colored = Buffer.alloc(300); // 10x10 px RGB
  for (let i = 0; i < colored.length; i += 3) colored[i] = 255; // rojo puro → saturación 1
  const grey = Buffer.alloc(300, 128); // gris uniforme → saturación 0
  return { colored, grey, rawPixels: colored };
});

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    removeAlpha: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
    rotate: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockImplementation((opts?: { resolveWithObject?: boolean }) =>
      opts?.resolveWithObject
        ? Promise.resolve({ data: sharpState.rawPixels, info: { width: 10, height: 10 } })
        : Promise.resolve(Buffer.from('fake-jpeg'))
    ),
  })),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeFetchResponse(text: string) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ response: text }),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  sharpState.rawPixels = sharpState.colored;
});

// ── extractJsonObject (real implementation) ─────────────────────────────────

describe('extractJsonObject', () => {
  it('extracts a clean JSON object', () => {
    expect(extractJsonObject('{"year": 2023, "tags": ["travel"]}')).toBe('{"year": 2023, "tags": ["travel"]}');
  });

  it('extracts JSON embedded in prose', () => {
    const raw = 'Here is the result: {"year": null, "concept": "portrait"} done.';
    expect(extractJsonObject(raw)).toBe('{"year": null, "concept": "portrait"}');
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n{"score": 8}\n```';
    expect(extractJsonObject(raw)).toBe('{"score": 8}');
  });

  it('returns {} when no opening brace is found', () => {
    expect(extractJsonObject('no json here at all')).toBe('{}');
  });

  it('handles empty string input', () => {
    expect(extractJsonObject('')).toBe('{}');
  });

  it('handles nested objects correctly', () => {
    const raw = '{"a": {"b": 1}, "c": 2}';
    expect(extractJsonObject(raw)).toBe('{"a": {"b": 1}, "c": 2}');
  });

  it('stops at the correct closing brace with trailing text', () => {
    const raw = '{"ok": true} extra text';
    expect(extractJsonObject(raw)).toBe('{"ok": true}');
  });

  it('handles strings containing braces without breaking depth counting', () => {
    const raw = '{"msg": "hello {world}"}';
    expect(extractJsonObject(raw)).toBe('{"msg": "hello {world}"}');
  });
});

// ── parseSearchQuery — real parsing, mocked fetch ───────────────────────────

describe('parseSearchQuery', () => {
  it('parses a well-formed JSON response from Ollama', async () => {
    const { parseSearchQuery } = await import('@/lib/ollama/search');
    mockFetch.mockReturnValueOnce(makeFetchResponse(
      '{"year": 2023, "concept": "travel landscapes", "tags": ["landscape", "travel"]}'
    ));
    const result = await parseSearchQuery('paisajes de viaje 2023');
    expect(result.year).toBe(2023);
    expect(result.concept).toBe('travel landscapes');
    expect(result.tags).toEqual(['landscape', 'travel']);
  });

  it('extracts JSON embedded in Ollama prose', async () => {
    const { parseSearchQuery } = await import('@/lib/ollama/search');
    mockFetch.mockReturnValueOnce(makeFetchResponse(
      'Sure! Here you go: {"year": null, "concept": "portrait", "tags": ["portrait"]}'
    ));
    const result = await parseSearchQuery('retratos');
    expect(result.year).toBeNull();
    expect(result.concept).toBe('portrait');
    expect(result.tags).toContain('portrait');
  });

  it('returns safe defaults when Ollama returns empty string', async () => {
    const { parseSearchQuery } = await import('@/lib/ollama/search');
    mockFetch.mockReturnValueOnce(makeFetchResponse(''));
    const result = await parseSearchQuery('my query');
    expect(result.year).toBeNull();
    expect(result.concept).toBe('my query');
    expect(result.tags).toEqual([]);
  });

  it('returns safe defaults when JSON is malformed', async () => {
    const { parseSearchQuery } = await import('@/lib/ollama/search');
    mockFetch.mockReturnValueOnce(makeFetchResponse('{bad json}}'));
    const result = await parseSearchQuery('my query');
    expect(result.year).toBeNull();
    expect(result.tags).toEqual([]);
  });

  it('throws when Ollama returns a non-ok status (timeout/error propagates)', async () => {
    const { parseSearchQuery } = await import('@/lib/ollama/search');
    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: false, status: 503, text: () => Promise.resolve('') }));
    await expect(parseSearchQuery('query')).rejects.toThrow('Ollama error 503');
  });

  it('coerces missing tags to empty array', async () => {
    const { parseSearchQuery } = await import('@/lib/ollama/search');
    mockFetch.mockReturnValueOnce(makeFetchResponse('{"year": 2020, "concept": "test"}'));
    const result = await parseSearchQuery('test');
    expect(result.tags).toEqual([]);
  });
});

// ── classifyPhoto — real tag parsing, mocked fetch + sharp ──────────────────

describe('classifyPhoto', () => {
  it('parses a clean tag list and prepends the color tag', async () => {
    const { classifyPhoto } = await import('@/lib/ollama/classify');
    mockFetch.mockReturnValueOnce(makeFetchResponse('portrait, editorial, work, studio, woman'));
    const tags = await classifyPhoto('2023/test/photo.jpg', '/photos');
    expect(tags).toEqual(['color', 'portrait', 'editorial', 'work', 'studio', 'woman']);
  });

  it('prepends b&w when the photo has no colored pixels', async () => {
    const { classifyPhoto } = await import('@/lib/ollama/classify');
    sharpState.rawPixels = sharpState.grey;
    mockFetch.mockReturnValueOnce(makeFetchResponse('street, night'));
    const tags = await classifyPhoto('2023/test/photo.jpg', '/photos');
    expect(tags).toEqual(['b&w', 'street', 'night']);
  });

  it('strips disallowed characters from tags', async () => {
    const { classifyPhoto } = await import('@/lib/ollama/classify');
    mockFetch.mockReturnValueOnce(makeFetchResponse('street!, "editorial"'));
    const tags = await classifyPhoto('2023/test/photo.jpg', '/photos');
    expect(tags[1]).toBe('street');
    expect(tags[2]).toBe('editorial');
  });

  it('limits output to 6 tags (color tag + 5 AI tags)', async () => {
    const { classifyPhoto } = await import('@/lib/ollama/classify');
    mockFetch.mockReturnValueOnce(makeFetchResponse('a, b, c, d, e, f, g, h'));
    const tags = await classifyPhoto('2023/test/photo.jpg', '/photos');
    expect(tags).toHaveLength(6);
  });

  it('returns only the color tag when Ollama returns empty response', async () => {
    const { classifyPhoto } = await import('@/lib/ollama/classify');
    mockFetch.mockReturnValueOnce(makeFetchResponse(''));
    const tags = await classifyPhoto('2023/test/photo.jpg', '/photos');
    expect(tags).toEqual(['color']);
  });
});

// ── reviewPhoto — real JSON parsing, mocked fetch + sharp ───────────────────

describe('reviewPhoto', () => {
  it('parses a complete review response', async () => {
    const { reviewPhoto } = await import('@/lib/ollama/review');
    const payload = JSON.stringify({
      composition: 'Rule of thirds applied well.',
      light: 'Soft golden-hour light.',
      strengths: ['Strong subject', 'Good depth of field'],
      weaknesses: ['Slight blur on the left edge'],
      score: 8,
      summary: 'A strong portrait with excellent light.',
    });
    mockFetch.mockReturnValueOnce(makeFetchResponse(payload));
    const r = await reviewPhoto('2023/test/photo.jpg', '/photos');
    expect(r.score).toBe(8);
    expect(r.summary).toBe('A strong portrait with excellent light.');
    expect(r.strengths).toHaveLength(2);
    expect(r.weaknesses).toHaveLength(1);
  });

  it('clamps score to [1, 10]', async () => {
    const { reviewPhoto } = await import('@/lib/ollama/review');
    mockFetch.mockReturnValueOnce(makeFetchResponse(JSON.stringify({ score: 15, summary: 'ok' })));
    const r = await reviewPhoto('2023/test/photo.jpg', '/photos');
    expect(r.score).toBe(10);
  });

  it('returns zero score sentinel when score is absent', async () => {
    const { reviewPhoto } = await import('@/lib/ollama/review');
    mockFetch.mockReturnValueOnce(makeFetchResponse(JSON.stringify({ summary: 'ok' })));
    const r = await reviewPhoto('2023/test/photo.jpg', '/photos');
    expect(r.score).toBe(0);
  });

  it('returns empty fields when Ollama returns non-JSON text', async () => {
    const { reviewPhoto } = await import('@/lib/ollama/review');
    mockFetch.mockReturnValueOnce(makeFetchResponse('I cannot analyze this image.'));
    const r = await reviewPhoto('2023/test/photo.jpg', '/photos');
    expect(r.score).toBe(0);
    expect(r.summary).toBe('');
  });

  it('truncates strengths and weaknesses to 3', async () => {
    const { reviewPhoto } = await import('@/lib/ollama/review');
    mockFetch.mockReturnValueOnce(makeFetchResponse(JSON.stringify({
      strengths: ['a', 'b', 'c', 'd', 'e'],
      weaknesses: ['x', 'y', 'z', 'w'],
      score: 7,
    })));
    const r = await reviewPhoto('2023/test/photo.jpg', '/photos');
    expect(r.strengths).toHaveLength(3);
    expect(r.weaknesses).toHaveLength(3);
  });
});
