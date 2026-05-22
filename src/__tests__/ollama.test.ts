import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Helpers that mirror the parsing logic in ollama.ts ──────────────────────
// We test the JSON-parsing / post-processing layers in isolation,
// without making real HTTP calls to Ollama.

function parseSearchResponse(raw: string): { year: number | null; concept: string; tags: string[] } {
  try {
    const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
    const parsed = JSON.parse(json);
    return {
      year: parsed.year ?? null,
      concept: parsed.concept ?? '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
  } catch {
    return { year: null, concept: raw, tags: [] };
  }
}

function parseReviewResponse(raw: string) {
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

function parseClassifyTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t: string) => t.trim().toLowerCase().replace(/[^a-z0-9 áéíóúñüàèìòùâêîôûäëïöü\-&]/g, ''))
    .filter((t: string) => t.length > 0 && t.length < 50)
    .slice(0, 6);
}

// ── parseSearchQuery parsing ────────────────────────────────────────────────

describe('parseSearchResponse', () => {
  it('parses a well-formed JSON response', () => {
    const raw = '{"year": 2023, "concept": "travel landscapes", "tags": ["landscape", "travel"]}';
    const result = parseSearchResponse(raw);
    expect(result.year).toBe(2023);
    expect(result.concept).toBe('travel landscapes');
    expect(result.tags).toEqual(['landscape', 'travel']);
  });

  it('extracts JSON embedded in prose', () => {
    const raw = 'Here is the result: {"year": null, "concept": "portrait", "tags": ["portrait"]} done.';
    const result = parseSearchResponse(raw);
    expect(result.year).toBeNull();
    expect(result.concept).toBe('portrait');
    expect(result.tags).toContain('portrait');
  });

  it('returns safe defaults when JSON is missing', () => {
    const result = parseSearchResponse('no json here at all');
    expect(result.year).toBeNull();
    expect(result.tags).toEqual([]);
  });

  it('handles malformed JSON gracefully', () => {
    const result = parseSearchResponse('{bad json}}');
    expect(result.year).toBeNull();
    expect(result.tags).toEqual([]);
  });

  it('coerces missing tags to empty array', () => {
    const result = parseSearchResponse('{"year": 2020, "concept": "test"}');
    expect(result.tags).toEqual([]);
  });
});

// ── reviewPhoto response parsing ────────────────────────────────────────────

describe('parseReviewResponse', () => {
  const validRaw = JSON.stringify({
    composition: 'Rule of thirds applied well.',
    light: 'Soft golden-hour light.',
    strengths: ['Strong subject', 'Good depth of field'],
    weaknesses: ['Slight blur on the left edge'],
    score: 8,
    summary: 'A strong portrait with excellent light.',
  });

  it('parses a complete review response', () => {
    const r = parseReviewResponse(validRaw);
    expect(r.score).toBe(8);
    expect(r.summary).toBe('A strong portrait with excellent light.');
    expect(r.strengths).toHaveLength(2);
    expect(r.weaknesses).toHaveLength(1);
  });

  it('clamps score to [1, 10] when a number is present', () => {
    // score:0 is a number so Math.max(1, 0) → 1
    expect(parseReviewResponse(JSON.stringify({ score: 0 })).score).toBe(1);
    expect(parseReviewResponse(JSON.stringify({ score: 11 })).score).toBe(10);
    expect(parseReviewResponse(JSON.stringify({ score: -5 })).score).toBe(1);
    // absent score → 0 sentinel (used by UI to hide the score widget)
    expect(parseReviewResponse(JSON.stringify({ summary: 'ok' })).score).toBe(0);
  });

  it('truncates strengths and weaknesses to 3', () => {
    const raw = JSON.stringify({
      strengths: ['a', 'b', 'c', 'd', 'e'],
      weaknesses: ['x', 'y', 'z', 'w'],
      score: 7,
    });
    const r = parseReviewResponse(raw);
    expect(r.strengths).toHaveLength(3);
    expect(r.weaknesses).toHaveLength(3);
  });

  it('returns empty fields when Ollama returns non-JSON text (no braces)', () => {
    // regex finds no JSON → falls back to '{}' → parses fine → all fields empty
    const r = parseReviewResponse('not valid json at all');
    expect(r.score).toBe(0);
    expect(r.summary).toBe('');  // catch block NOT reached; fallback is empty string
  });

  it('returns raw text as summary when JSON.parse throws (malformed braces)', () => {
    // regex matches something, but JSON.parse throws → catch returns raw text
    const r = parseReviewResponse('result: { bad: json: here }');
    expect(r.score).toBe(0);
    expect(r.summary).toBe('result: { bad: json: here }');
  });
});

// ── classifyPhoto tag parsing ────────────────────────────────────────────────

describe('parseClassifyTags', () => {
  it('parses a clean comma-separated list', () => {
    const tags = parseClassifyTags('color, portrait, editorial, work, studio, woman');
    expect(tags).toEqual(['color', 'portrait', 'editorial', 'work', 'studio', 'woman']);
  });

  it('strips non-allowed characters', () => {
    const tags = parseClassifyTags('b&w, street, "editorial"');
    expect(tags[0]).toBe('b&w');
    expect(tags[1]).toBe('street');
    expect(tags[2]).toBe('editorial'); // quotes stripped
  });

  it('limits to 6 tags', () => {
    const raw = 'a, b, c, d, e, f, g, h';
    expect(parseClassifyTags(raw)).toHaveLength(6);
  });

  it('filters out empty and oversized tags', () => {
    const longTag = 'a'.repeat(55);
    const tags = parseClassifyTags(`, , ${longTag}, valid`);
    expect(tags).toEqual(['valid']);
  });

  it('lowercases all tags', () => {
    const tags = parseClassifyTags('Color, PORTRAIT');
    expect(tags).toEqual(['color', 'portrait']);
  });
});
