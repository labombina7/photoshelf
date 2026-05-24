export interface ScanState {
  running: boolean;
  currentEvent: string;
  done: number;
  total: number;
  error: string | null;
  completedAt: number | null;
}

// Use globalThis so the singleton survives across Next.js route-handler bundles.
// In production, each route chunk gets its own module scope, but globalThis is
// shared for the lifetime of the Node.js process.
const g = globalThis as typeof globalThis & { __photoshelf_scan?: ScanState };

if (!g.__photoshelf_scan) {
  g.__photoshelf_scan = {
    running: false,
    currentEvent: '',
    done: 0,
    total: 0,
    error: null,
    completedAt: null,
  };
}

export function getScanState(): Readonly<ScanState> {
  return { ...g.__photoshelf_scan! };
}

export function updateScanState(patch: Partial<ScanState>): void {
  Object.assign(g.__photoshelf_scan!, patch);
}
