import { useEffect, useRef } from 'react';

export interface JobPollResponse {
  status: string;
  processed?: number;
  total?: number;
  error_count?: number;
  result?: string;
  error_last?: string;
}

interface UseJobPollingOptions {
  intervalMs?: number;
  onProgress?: (job: JobPollResponse) => void;
  onComplete?: (job: JobPollResponse) => void;
  onFail?: (job: JobPollResponse) => void;
}

export function useJobPolling(
  jobId: string | null,
  options: UseJobPollingOptions,
) {
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; });

  useEffect(() => {
    if (!jobId) return;
    const { intervalMs = 2000 } = optionsRef.current;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const job = await res.json() as JobPollResponse;
        optionsRef.current.onProgress?.(job);
        if (job.status === 'completed') {
          clearInterval(interval);
          optionsRef.current.onComplete?.(job);
        } else if (job.status === 'failed' || job.status === 'cancelled') {
          clearInterval(interval);
          optionsRef.current.onFail?.(job);
        }
      } catch { /* ignore network errors */ }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [jobId]);
}
