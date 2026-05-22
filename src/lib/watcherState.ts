export interface WatcherState {
  enabled: boolean;
  watching: boolean;
  lastScanAt: number | null;
  reason: string | null;
  classifying: boolean;
  classifyDone: number;
  classifyTotal: number;
}

const state: WatcherState = {
  enabled: true,
  watching: false,
  lastScanAt: null,
  reason: null,
  classifying: false,
  classifyDone: 0,
  classifyTotal: 0,
};

export function getWatcherState(): Readonly<WatcherState> {
  return { ...state };
}

export function updateWatcherState(patch: Partial<WatcherState>): void {
  Object.assign(state, patch);
}
