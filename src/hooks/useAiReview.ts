'use client';

import { useState } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { PhotoReview } from '@/lib/ollama';

export function useAiReview(photoId: number) {
  const { track } = useAnalytics();
  const [classifying, setClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<PhotoReview | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function classify(): Promise<string[] | null> {
    track('ai_classify_triggered');
    setClassifying(true);
    setClassifyError(null);
    try {
      const res = await fetch(`/api/ai/classify/${photoId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);
      if (data.tags?.length === 0) {
        setClassifyError('La IA no generó ningún tag. Comprueba que Ollama esté disponible.');
        return null;
      }
      return data.tags as string[] ?? null;
    } catch (err) {
      setClassifyError(err instanceof Error ? err.message : 'Error al clasificar la imagen');
      return null;
    } finally {
      setClassifying(false);
    }
  }

  async function requestReview() {
    setReviewing(true);
    setReview(null);
    setReviewError(null);
    try {
      const res = await fetch(`/api/ai/review/${photoId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);
      const r = data as PhotoReview;
      const isEmpty = !r.score && !r.summary && !r.composition && !r.light
        && r.strengths.length === 0 && r.weaknesses.length === 0;
      if (isEmpty) throw new Error('La IA no pudo generar un análisis. Comprueba que Ollama esté disponible e inténtalo de nuevo.');
      setReview(r);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Error al analizar la imagen');
    } finally {
      setReviewing(false);
    }
  }

  return {
    classifying, classifyError,
    reviewing, review, setReview,
    reviewError, setReviewError,
    classify, requestReview,
  };
}
