export interface ClassifyState {
  running: boolean;
  year: number | null;
  currentEvent: string;
  done: number;
  total: number;
  errors: number;
  firstError: string | null;
  error: string | null;
  completedAt: number | null;
}

const g = globalThis as typeof globalThis & { __photoshelf_classify?: ClassifyState };

if (!g.__photoshelf_classify) {
  g.__photoshelf_classify = {
    running: false,
    year: null,
    currentEvent: '',
    done: 0,
    total: 0,
    errors: 0,
    firstError: null,
    error: null,
    completedAt: null,
  };
}

export function getClassifyState(): Readonly<ClassifyState> {
  return { ...g.__photoshelf_classify! };
}

export function updateClassifyState(patch: Partial<ClassifyState>): void {
  Object.assign(g.__photoshelf_classify!, patch);
}
