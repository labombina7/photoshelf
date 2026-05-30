export interface AiSearchState {
  running: boolean;
  startedAt: number | null;
}

const g = globalThis as typeof globalThis & { __photoshelf_ai_search?: AiSearchState };

if (!g.__photoshelf_ai_search) {
  g.__photoshelf_ai_search = { running: false, startedAt: null };
}

export function getAiSearchState(): Readonly<AiSearchState> {
  return { ...g.__photoshelf_ai_search! };
}

export function updateAiSearchState(patch: Partial<AiSearchState>): void {
  Object.assign(g.__photoshelf_ai_search!, patch);
}
