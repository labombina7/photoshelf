'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface ScanState {
  running: boolean;
  currentEvent: string;
  done: number;
  total: number;
  error: string | null;
}

interface WatcherState {
  enabled: boolean;
  watching: boolean;
  lastScanAt: number | null;
  reason: string | null;
  classifying: boolean;
  classifyDone: number;
  classifyTotal: number;
}

interface ScanContextValue extends ScanState {
  startScan: () => Promise<void>;
  watcher: WatcherState;
  toggleWatcher: () => Promise<void>;
}

const defaultWatcher: WatcherState = {
  enabled: true, watching: false, lastScanAt: null,
  reason: null, classifying: false, classifyDone: 0, classifyTotal: 0,
};

const ScanContext = createContext<ScanContextValue>({
  running: false, currentEvent: '', done: 0, total: 0, error: null,
  startScan: async () => {},
  watcher: defaultWatcher,
  toggleWatcher: async () => {},
});

export function useScan() {
  return useContext(ScanContext);
}

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<ScanState>({
    running: false, currentEvent: '', done: 0, total: 0, error: null,
  });
  const [watcher, setWatcher] = useState<WatcherState>(defaultWatcher);
  const [showDone, setShowDone] = useState(false);
  const wasRunningRef = useRef(false);
  const wasClassifyingRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const [scanRes, watcherRes] = await Promise.all([
          fetch('/api/scan/status'),
          fetch('/api/watcher/status'),
        ]);
        if (!active) return;

        if (scanRes.ok) {
          const data: ScanState = await scanRes.json();
          setState(data);

          if (wasRunningRef.current && !data.running) {
            setShowDone(true);
            router.refresh();
            setTimeout(() => setShowDone(false), 3000);
          }
          wasRunningRef.current = data.running;
        }

        if (watcherRes.ok) {
          const wData: WatcherState = await watcherRes.json();
          setWatcher(wData);

          // Refresh UI when auto-classify finishes
          if (wasClassifyingRef.current && !wData.classifying) {
            router.refresh();
          }
          wasClassifyingRef.current = wData.classifying;
        }
      } catch { /* ignore network errors */ }
    }

    poll();
    const interval = setInterval(poll, 2000);
    return () => { active = false; clearInterval(interval); };
  }, [router]);

  async function startScan(): Promise<void> {
    const res = await fetch('/api/scan', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? 'Error al iniciar el análisis');
    }
  }

  const toggleWatcher = useCallback(async () => {
    const res = await fetch('/api/watcher/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !watcher.enabled }),
    });
    if (res.ok) setWatcher(await res.json());
  }, [watcher.enabled]);

  const visible = state.running || showDone || watcher.classifying;
  const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
  const isAuto = state.running && state.currentEvent.startsWith('Auto-escaneo');
  const classifyPct = watcher.classifyTotal > 0
    ? Math.round((watcher.classifyDone / watcher.classifyTotal) * 100)
    : 0;

  return (
    <ScanContext.Provider value={{ ...state, startScan, watcher, toggleWatcher }}>
      {children}
      {visible && (
        <div className="scan-toast">
          <div className="scan-toast-header">
            <span className="scan-toast-title">
              {watcher.classifying
                ? 'Clasificando fotos nuevas'
                : state.running
                  ? (isAuto ? '⚡ Auto-escaneo' : 'Escaneando biblioteca')
                  : state.error ? 'Error en el escaneo' : '✓ Escaneo completado'}
            </span>
            {state.running && state.total > 0 && (
              <span className="scan-toast-count">{state.done}/{state.total}</span>
            )}
            {watcher.classifying && watcher.classifyTotal > 0 && (
              <span className="scan-toast-count">{watcher.classifyDone}/{watcher.classifyTotal}</span>
            )}
          </div>

          {state.running && state.currentEvent && !isAuto && (
            <div className="scan-toast-event">{state.currentEvent}</div>
          )}
          {isAuto && watcher.reason && (
            <div className="scan-toast-event">Nueva carpeta: {watcher.reason}</div>
          )}
          {watcher.classifying && (
            <div className="scan-toast-event">Asignando tags con IA…</div>
          )}
          {state.error && (
            <div className="scan-toast-event" style={{ color: '#c0392b' }}>{state.error}</div>
          )}

          {state.running && state.total > 0 && (
            <div className="scan-toast-track">
              <div className="scan-toast-fill" style={{ width: `${pct}%` }} />
            </div>
          )}
          {state.running && state.total === 0 && (
            <div className="scan-toast-track">
              <div className="scan-toast-indeterminate" />
            </div>
          )}
          {watcher.classifying && watcher.classifyTotal > 0 && (
            <div className="scan-toast-track">
              <div className="scan-toast-fill" style={{ width: `${classifyPct}%` }} />
            </div>
          )}
          {watcher.classifying && watcher.classifyTotal === 0 && (
            <div className="scan-toast-track">
              <div className="scan-toast-indeterminate" />
            </div>
          )}
        </div>
      )}
    </ScanContext.Provider>
  );
}
