export interface WatcherState {
  enabled: boolean;
  watching: boolean;
  lastScanAt: number | null;
  reason: string | null;
  classifying: boolean;
  classifyDone: number;
  classifyTotal: number;
}

const g = globalThis as typeof globalThis & { __photoshelf_watcher?: WatcherState };

if (!g.__photoshelf_watcher) {
  g.__photoshelf_watcher = {
    enabled: true,
    watching: false,
    lastScanAt: null,
    reason: null,
    classifying: false,
    classifyDone: 0,
    classifyTotal: 0,
  };
}

export function getWatcherState(): Readonly<WatcherState> {
  return { ...g.__photoshelf_watcher! };
}

export function updateWatcherState(patch: Partial<WatcherState>): void {
  Object.assign(g.__photoshelf_watcher!, patch);
}
