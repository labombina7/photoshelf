export interface ScanState {
  running: boolean;
  currentEvent: string;
  done: number;
  total: number;
  error: string | null;
  completedAt: number | null;
}

// Module-level singleton — persists for the lifetime of the Node.js process
const state: ScanState = {
  running: false,
  currentEvent: '',
  done: 0,
  total: 0,
  error: null,
  completedAt: null,
};

export function getScanState(): Readonly<ScanState> {
  return { ...state };
}

export function updateScanState(patch: Partial<ScanState>): void {
  Object.assign(state, patch);
}
