import { useEffect, useRef } from 'react';

export interface JobPollResponse {
  status: string;
  processed?: number;
  total?: number;
  error_count?: number;
  result?: string;
  error_last?: string;
}

interface UseJobPollingOptions<T> {
  intervalMs?: number;
  /** URL a pollear. Por defecto `/api/jobs/{jobId}`. */
  endpoint?: string;
  onProgress?: (job: T) => void;
  onComplete?: (job: T) => void;
  onFail?: (job: T) => void;
}

/**
 * Polling compartido de jobs: tick inmediato + intervalo, parada en estado
 * terminal (completed/failed/cancelled) y limpieza garantizada en unmount.
 *
 * Con `endpoint` se puede pollear una URL de estado distinta (p. ej. el status
 * global de clasificación); si esa URL nunca devuelve un estado terminal, el
 * polling es continuo mientras `jobId` no sea null.
 */
export function useJobPolling<T extends { status: string } = JobPollResponse>(
  jobId: string | null,
  options: UseJobPollingOptions<T>,
) {
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; });

  useEffect(() => {
    if (!jobId) return;
    const { intervalMs = 2000, endpoint } = optionsRef.current;
    const url = endpoint ?? `/api/jobs/${jobId}`;
    let stopped = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const tick = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok || stopped) return;
        const job = await res.json() as T;
        if (stopped) return;
        optionsRef.current.onProgress?.(job);
        if (job.status === 'completed') {
          stopped = true;
          clearInterval(interval);
          optionsRef.current.onComplete?.(job);
        } else if (job.status === 'failed' || job.status === 'cancelled') {
          stopped = true;
          clearInterval(interval);
          optionsRef.current.onFail?.(job);
        }
      } catch { /* ignore network errors */ }
    };

    void tick();
    interval = setInterval(tick, intervalMs);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [jobId]);
}
