import { callOllama } from './client';
import { extractJsonObject } from './utils';
import { OLLAMA_TIMEOUT_CLASSIFY_MS } from '@/lib/config';

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

export interface ProjectFilters {
  tone?: string;
  styles?: string[];
  tags?: string[];
}

export async function generateProject(
  candidates: ProjectCandidate[],
  count: number,
  filters?: ProjectFilters
): Promise<GeneratedProject> {
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);

  const photoList = shuffled
    .map(p => `ID:${p.id} | ${p.year}/${p.event} | tags: ${p.tags.join(', ') || 'none'}`)
    .join('\n');

  const maxPerEvent = Math.max(2, Math.ceil(count / 4));

  const toneOrTagConstraints = !!(filters?.tone || filters?.tags?.length);
  const hardConstraints = toneOrTagConstraints ? `
==== HARD CONSTRAINTS — NON-NEGOTIABLE ====
${filters?.tone ? `TONE: You MUST select ONLY ${filters.tone} photos. Any photo without the tag "${filters.tone}" in its tag list is FORBIDDEN. Do not select it under any circumstance.` : ''}
${filters?.tags?.length ? `TAGS: Every selected photo MUST include ALL of these tags: ${filters.tags.join(', ')}.` : ''}
===========================================
` : '';

  const aestheticDirection = filters?.styles?.length ? `
==== AESTHETIC DIRECTION ====
The curator wants a project in the style of: ${filters.styles.join(', ')}.
Use this as creative guidance when choosing between equally good photos — prefer images whose tags suggest this aesthetic. It is NOT a hard filter; you may include photos that fit the overall vision even if they lack an exact style tag match.
=============================
` : '';

  const raw = await callOllama(
    `You are an experienced photography curator selecting images for a gallery exhibition.
${hardConstraints}${aestheticDirection}
Task: choose exactly ${count} photos from the list below to form a cohesive photographic project.

IMPORTANT: Read the ENTIRE list before making any selection. Do NOT pick photos just because they appear near the top — position in this list is random and meaningless.

Rules — follow ALL of them:
1. SCAN FIRST: Go through all ${shuffled.length} photos before deciding. The best photos may be anywhere in the list.
2. QUALITY: Strongly prefer photos with more specific tags (e.g. "portrait, editorial, studio, woman") over untagged ones or those with only generic tags.
3. DIVERSITY: Do not pick more than ${maxPerEvent} photos from the same event folder. Spread across different events and years.
4. VARIETY: If two photos share the same event and similar tags, pick only one — the one with richer or more specific tags.
5. TONE: ${filters?.tone ? `ONLY ${filters.tone} photos — this is a hard constraint already stated above. Reject any photo without the "${filters.tone}" tag.` : 'b&w and color photos can be mixed if it strengthens the narrative.'}
6. NARRATIVE ARC: Order the final selectedIds to tell a visual story — opening image, development, climax, closing.

Photos (ID | year/event | tags):
${photoList}

Reply ONLY with this JSON, no explanation, no markdown:
{
  "title": "short evocative title in Spanish (3-6 words)",
  "statement": "2-3 sentences on the project theme and emotional intent, in Spanish",
  "selectedIds": [exactly ${count} photo IDs ordered narratively]
}`,
    OLLAMA_TIMEOUT_CLASSIFY_MS
  );

  try {
    const json = extractJsonObject(raw);
    const parsed = JSON.parse(json);
    const candidateSet = new Map(candidates.map(c => [c.id, c]));
    const selectedIds: number[] = Array.isArray(parsed.selectedIds)
      ? parsed.selectedIds
          .map((id: unknown) => Number(id))
          .filter((id: number) => {
            const c = candidateSet.get(id);
            if (!c) return false;
            if (filters?.tone && !c.tags.includes(filters.tone)) return false;
            if (filters?.tags?.length && !filters.tags.every(t => c.tags.includes(t))) return false;
            return true;
          })
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
