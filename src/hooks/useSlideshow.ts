'use client';

import { useState, useCallback, useEffect } from 'react';

interface SlideshowFilters {
  year?: string;
  event?: string;
  theme?: string;
  favorite?: string;
  untagged?: string;
  q?: string;
}

export function useSlideshow(filters: SlideshowFilters) {
  const [slideshowIds, setSlideshowIds] = useState<number[] | null>(null);

  const openSlideshow = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.year) params.set('year', filters.year);
    if (filters.event) params.set('event', filters.event);
    if (filters.theme) params.set('theme', filters.theme);
    if (filters.favorite) params.set('favorite', filters.favorite);
    if (filters.untagged) params.set('untagged', filters.untagged);
    if (filters.q) params.set('q', filters.q);
    const res = await fetch(`/api/photos/ids?${params.toString()}`);
    const data = await res.json() as { ids: number[] };
    if (data.ids.length > 0) setSlideshowIds(data.ids);
  }, [filters.year, filters.event, filters.theme, filters.favorite, filters.untagged, filters.q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'p' || e.key === 'P') {
        if (slideshowIds) setSlideshowIds(null);
        else void openSlideshow();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slideshowIds, openSlideshow]);

  return { slideshowIds, setSlideshowIds, openSlideshow };
}
