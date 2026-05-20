'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ScanState {
  running: boolean;
  currentEvent: string;
  done: number;
  total: number;
  error: string | null;
}

interface ScanContextValue extends ScanState {
  startScan: () => Promise<void>;
}

const ScanContext = createContext<ScanContextValue>({
  running: false,
  currentEvent: '',
  done: 0,
  total: 0,
  error: null,
  startScan: async () => {},
});

export function useScan() {
  return useContext(ScanContext);
}

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<ScanState>({
    running: false,
    currentEvent: '',
    done: 0,
    total: 0,
    error: null,
  });
  const [showDone, setShowDone] = useState(false);
  const wasRunningRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch('/api/scan/status');
        if (!res.ok || !active) return;
        const data: ScanState = await res.json();
        setState(data);

        if (wasRunningRef.current && !data.running) {
          setShowDone(true);
          router.refresh();
          setTimeout(() => setShowDone(false), 3000);
        }
        wasRunningRef.current = data.running;
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
    // state updates via polling
  }

  const visible = state.running || showDone;
  const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;

  return (
    <ScanContext.Provider value={{ ...state, startScan }}>
      {children}
      {visible && (
        <div className="scan-toast">
          <div className="scan-toast-header">
            <span className="scan-toast-title">
              {state.running
                ? 'Escaneando biblioteca'
                : state.error ? 'Error en el escaneo' : '✓ Escaneo completado'}
            </span>
            {state.running && state.total > 0 && (
              <span className="scan-toast-count">{state.done}/{state.total}</span>
            )}
          </div>
          {state.running && state.currentEvent && (
            <div className="scan-toast-event">{state.currentEvent}</div>
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
        </div>
      )}
    </ScanContext.Provider>
  );
}
