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
  startClassify: (year: number, force?: boolean) => Promise<void>;
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
          router.refresh();
        }
        wasRunningRef.current = data.running;
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
  }

  return (
    <ClassifyContext.Provider value={{ ...state, startClassify }}>
      {children}
    </ClassifyContext.Provider>
  );
}
