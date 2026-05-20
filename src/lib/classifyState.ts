export interface ClassifyState {
  running: boolean;
  year: number | null;
  currentEvent: string;
  done: number;
  total: number;
  error: string | null;
  completedAt: number | null;
}

const state: ClassifyState = {
  running: false,
  year: null,
  currentEvent: '',
  done: 0,
  total: 0,
  error: null,
  completedAt: null,
};

export function getClassifyState(): Readonly<ClassifyState> {
  return { ...state };
}

export function updateClassifyState(patch: Partial<ClassifyState>): void {
  Object.assign(state, patch);
}
