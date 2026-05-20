'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ClassifyState {
  running: boolean;
  year: number | null;
  currentEvent: string;
  done: number;
  total: number;
  error: string | null;
}

interface ClassifyContextValue extends ClassifyState {
  startClassify: (year: number) => Promise<void>;
}

const ClassifyContext = createContext<ClassifyContextValue>({
  running: false,
  year: null,
  currentEvent: '',
  done: 0,
  total: 0,
  error: null,
  startClassify: async () => {},
});

export function useClassify() {
  return useContext(ClassifyContext);
}

export function ClassifyProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<ClassifyState>({
    running: false,
    year: null,
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
        const res = await fetch('/api/ai/classify/status');
        if (!res.ok || !active) return;
        const data: ClassifyState = await res.json();
        setState(data);

        if (wasRunningRef.current && !data.running) {
          setShowDone(true);
          router.refresh();
          setTimeout(() => setShowDone(false), 4000);
        }
        wasRunningRef.current = data.running;
      } catch { /* ignore */ }
    }

    poll();
    const interval = setInterval(poll, 2000);
    return () => { active = false; clearInterval(interval); };
  }, [router]);

  async function startClassify(year: number): Promise<void> {
    const res = await fetch('/api/ai/classify/year', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? 'Error al iniciar la clasificación');
    }
  }

  const visible = state.running || showDone;
  const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;

  return (
    <ClassifyContext.Provider value={{ ...state, startClassify }}>
      {children}
      {visible && (
        <div className="scan-toast" style={{ bottom: 90 }}>
          <div className="scan-toast-header">
            <span className="scan-toast-title">
              {state.running
                ? `Clasificando${state.year ? ` ${state.year}` : ''} con IA`
                : state.error ? 'Error en la clasificación' : '✓ Clasificación completada'}
            </span>
            {state.running && state.total > 0 && (
              <span className="scan-toast-count">{state.done}/{state.total}</span>
            )}
          </div>
          {state.running && state.currentEvent && (
            <div className="scan-toast-event">{state.currentEvent}</div>
          )}
          {state.error && (
            <div className="scan-toast-event" style={{ color: '#ff8a80' }}>{state.error}</div>
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
    </ClassifyContext.Provider>
  );
}
