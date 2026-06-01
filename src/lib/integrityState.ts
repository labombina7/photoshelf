export interface IntegrityState {
  running: boolean;
  phase: 'idle' | 'orphans' | 'unindexed' | 'corrupt' | 'done';
  checked: number;
  total: number;
  orphansFound: number;
  unindexedFound: number;
  corruptFound: number;
  error: string | null;
  completedAt: number | null;
}

const g = globalThis as typeof globalThis & { __photoshelf_integrity?: IntegrityState };

if (!g.__photoshelf_integrity) {
  g.__photoshelf_integrity = {
    running: false,
    phase: 'idle',
    checked: 0,
    total: 0,
    orphansFound: 0,
    unindexedFound: 0,
    corruptFound: 0,
    error: null,
    completedAt: null,
  };
}

export function getIntegrityState(): Readonly<IntegrityState> {
  return { ...g.__photoshelf_integrity! };
}

export function updateIntegrityState(patch: Partial<IntegrityState>): void {
  Object.assign(g.__photoshelf_integrity!, patch);
}
