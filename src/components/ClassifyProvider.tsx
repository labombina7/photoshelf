'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type ClassifyStatus = 'idle' | 'pending' | 'in_progress';

interface ClassifyState {
  status: ClassifyStatus;
  /** true when status is in_progress (backward compat) */
  running: boolean;
  /** true when status is pending (job enqueued, not started yet) */
  pending: boolean;
  year: number | null;
  done: number;
  total: number;
  error: string | null;
  jobId: string | null;
}

interface ClassifyContextValue extends ClassifyState {
  startClassify: (year: number, force?: boolean) => Promise<void>;
}

const ClassifyContext = createContext<ClassifyContextValue>({
  status: 'idle',
  running: false,
  pending: false,
  year: null,
  done: 0,
  total: 0,
  error: null,
  jobId: null,
  startClassify: async () => {},
});

export function useClassify() {
  return useContext(ClassifyContext);
}

export function ClassifyProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<ClassifyState>({
    status: 'idle',
    running: false,
    pending: false,
    year: null,
    done: 0,
    total: 0,
    error: null,
    jobId: null,
  });
  const wasActiveRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch('/api/ai/classify/status');
        if (!res.ok || !active) return;
        const data = await res.json() as {
          status: ClassifyStatus;
          running: boolean;
          pending: boolean;
          year: number | null;
          done: number;
          total: number;
          error: string | null;
          jobId: string | null;
        };
        setState({
          status: data.status ?? 'idle',
          running: data.running ?? false,
          pending: data.pending ?? false,
          year: data.year,
          done: data.done,
          total: data.total,
          error: data.error,
          jobId: data.jobId,
        });

        const isActive = data.running || data.pending;
        if (wasActiveRef.current && !isActive) {
          router.refresh();
        }
        wasActiveRef.current = isActive;
      } catch { /* ignore */ }
    }

    poll();
    const interval = setInterval(poll, 2000);
    return () => { active = false; clearInterval(interval); };
  }, [router]);

  async function startClassify(year: number, force = false): Promise<void> {
    const res = await fetch('/api/ai/classify/year', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, force }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? 'Error al iniciar la clasificación');
    }
    // Optimistic update so the button reacts immediately
    setState(s => ({ ...s, status: 'pending', pending: true, running: false, year }));
  }

  return (
    <ClassifyContext.Provider value={{ ...state, startClassify }}>
      {children}
    </ClassifyContext.Provider>
  );
}
