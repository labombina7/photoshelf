'use client';

import { useState } from 'react';

interface DeepResult {
  id: number; filename: string; year: number; event: string; taken_at: string | null; is_favorite: number;
}

export function useAiSearch(query: string) {
  const [running, setRunning] = useState(false);
  const [analyzed, setAnalyzed] = useState(0);
  const [totalCand, setTotalCand] = useState(0);
  const [photos, setPhotos] = useState<DeepResult[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [done, setDone] = useState(false);

  async function runBatch(currentOffset: number) {
    setRunning(true);
    try {
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, mode: 'deep', offset: currentOffset }),
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const data = await res.json() as {
        photos: DeepResult[]; analyzed: number; next_offset: number;
        total_candidates: number; has_more: boolean;
      };
      setPhotos(prev => [...prev, ...data.photos]);
      setAnalyzed(currentOffset + data.analyzed);
      setTotalCand(data.total_candidates);
      setOffset(data.next_offset);
      setHasMore(data.has_more);
      if (!data.has_more) setDone(true);
    } finally {
      setRunning(false);
    }
  }

  return { running, analyzed, totalCand, photos, offset, hasMore, done, runBatch };
}
