import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getProjectCandidates, createProject, setProjectPhotos } from '@/lib/queries/projects';
import { generateProject } from '@/lib/ollama';
import type { ProjectCandidate } from '@/lib/ollama';

export const maxDuration = 300; // 5 min — Ollama needs time with large prompts

interface Candidate {
  id: number; filename: string; year: number; event: string; tags: string[];
}

function smartSample(all: Candidate[], max: number): Candidate[] {
  // Stratified sample: take proportionally from each event
  const byEvent = new Map<string, Candidate[]>();
  for (const c of all) {
    const key = `${c.year}|${c.event}`;
    if (!byEvent.has(key)) byEvent.set(key, []);
    byEvent.get(key)!.push(c);
  }

  const events = Array.from(byEvent.entries());
  const result: Candidate[] = [];
  let remaining = max;

  // Proportional allocation per event, tagged photos first within each
  events.forEach(([, photos], i) => {
    const share = Math.max(1, Math.round((photos.length / all.length) * max));
    const quota = i === events.length - 1 ? remaining : Math.min(share, remaining);
    // Shuffle first so ties in tag count don't favour filename order
    const shuffled = [...photos].sort(() => Math.random() - 0.5);
    const sorted = shuffled.sort((a, b) => b.tags.length - a.tags.length);
    result.push(...sorted.slice(0, quota));
    remaining -= Math.min(quota, sorted.length);
  });

  return result.slice(0, max);
}

interface GenerateBody {
  scopeType: 'year' | 'event' | 'theme' | 'all';
  scopeValue?: string;
  count: number;
  tone?: 'b&w' | 'color';
  styles?: string[];
  tags?: string[];
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
  const { scopeType, scopeValue, count = 15, tone, styles, tags: filterTags }: GenerateBody = await req.json();

  const rows = getProjectCandidates(scopeType, scopeValue);

  if (rows.length < 3) {
    return NextResponse.json({ error: 'Not enough photos in scope' }, { status: 400 });
  }

  const MAX_CANDIDATES = 150;
  let allCandidates = rows.map(r => ({
    id: r.id,
    filename: r.filename,
    year: r.year,
    event: r.event,
    tags: r.tag_list ? r.tag_list.split(',').filter(Boolean) : [],
  }));

  // Apply user filters strictly — when the user sets explicit constraints, honour them
  // regardless of how many photos remain. Never fall back to the unfiltered pool.
  // Only tone and tags are hard pre-filters (they have binary tag matches).
  // Styles are creative direction passed to the prompt, not a candidate filter.
  const hasUserFilters = !!(tone || filterTags?.length);
  if (hasUserFilters) {
    allCandidates = allCandidates.filter(c => {
      if (tone && !c.tags.includes(tone)) return false;
      if (filterTags?.length && !filterTags.every(t => c.tags.includes(t))) return false;
      return true;
    });
    if (allCandidates.length < 3) {
      return NextResponse.json(
        { error: `Solo ${allCandidates.length} foto(s) cumplen los filtros seleccionados. Prueba con un criterio menos restrictivo o un origen más amplio.` },
        { status: 400 }
      );
    }
  }

  const candidates: ProjectCandidate[] = allCandidates.length <= MAX_CANDIDATES
    ? allCandidates
    : smartSample(allCandidates, MAX_CANDIDATES);

  const actualCount = Math.min(count, candidates.length);
  const filters = { tone, styles, tags: filterTags };
  const { title, statement, selectedIds } = await generateProject(candidates, actualCount, filters);

  if (selectedIds.length === 0) {
    return NextResponse.json({ error: 'AI could not select photos' }, { status: 500 });
  }

  // Persist project
  const scopeLabel = scopeType === 'year' ? scopeValue
    : scopeType === 'event' ? scopeValue?.split('|').slice(1).join('|')
    : scopeType === 'theme' ? scopeValue
    : null;

  const projectId = createProject({ title, statement, scope_type: scopeType, scope_value: scopeLabel ?? null });
  setProjectPhotos(projectId, selectedIds);

  return NextResponse.json({ id: projectId, title, statement, photoCount: selectedIds.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[projects/generate] Error generating project:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
