import { describe, it, expect } from 'vitest';

// Mirror the post-generation guard logic from ollama.ts generateProject
interface Candidate { id: number; tags: string[] }
interface Filters { tone?: string; tags?: string[] }

function applyGuard(ids: number[], candidates: Candidate[], filters: Filters): number[] {
  const map = new Map(candidates.map(c => [c.id, c]));
  return ids.filter(id => {
    const c = map.get(id);
    if (!c) return false;
    if (filters.tone && !c.tags.includes(filters.tone)) return false;
    if (filters.tags?.length && !filters.tags.every(t => c.tags.includes(t))) return false;
    return true;
  });
}

describe('project generation post-filter guard', () => {
  const candidates: Candidate[] = [
    { id: 1, tags: ['b&w', 'portrait', 'editorial'] },
    { id: 2, tags: ['color', 'landscape', 'travel'] },
    { id: 3, tags: ['b&w', 'street', 'documentary'] },
    { id: 4, tags: ['color', 'portrait', 'fashion'] },
    { id: 5, tags: ['b&w', 'portrait', 'fashion'] },
  ];

  it('passes all ids when no filters', () => {
    expect(applyGuard([1, 2, 3, 4, 5], candidates, {})).toEqual([1, 2, 3, 4, 5]);
  });

  it('filters by tone (b&w)', () => {
    const result = applyGuard([1, 2, 3, 4, 5], candidates, { tone: 'b&w' });
    expect(result).toEqual([1, 3, 5]);
    expect(result).not.toContain(2);
    expect(result).not.toContain(4);
  });

  it('filters by tone (color)', () => {
    const result = applyGuard([1, 2, 3, 4, 5], candidates, { tone: 'color' });
    expect(result).toEqual([2, 4]);
  });

  it('filters by required tags', () => {
    const result = applyGuard([1, 2, 3, 4, 5], candidates, { tags: ['portrait'] });
    expect(result).toEqual([1, 4, 5]);
  });

  it('filters by tone AND tags combined', () => {
    const result = applyGuard([1, 2, 3, 4, 5], candidates, { tone: 'b&w', tags: ['portrait'] });
    expect(result).toEqual([1, 5]);
  });

  it('drops unknown ids silently', () => {
    expect(applyGuard([1, 99, 3], candidates, {})).toEqual([1, 3]);
  });

  it('returns empty when no candidates match', () => {
    expect(applyGuard([1, 2, 3, 4, 5], candidates, { tone: 'b&w', tags: ['fashion', 'landscape'] })).toEqual([]);
  });
});
