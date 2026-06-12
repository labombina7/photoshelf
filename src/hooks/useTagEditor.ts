'use client';

import { useState, useRef, useEffect } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { PhotoDetail } from '@/lib/types';

export function useTagEditor(photo: PhotoDetail) {
  const { track } = useAnalytics();
  const [tags, setTags] = useState(photo.tags);
  const [newTag, setNewTag] = useState('');
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const errorToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showErrorToast(msg: string) {
    if (errorToastTimer.current) clearTimeout(errorToastTimer.current);
    setErrorToast(msg);
    errorToastTimer.current = setTimeout(() => setErrorToast(null), 4000);
  }

  useEffect(() => () => { if (errorToastTimer.current) clearTimeout(errorToastTimer.current); }, []);

  async function addTag() {
    const name = newTag.trim().toLowerCase();
    if (!name) return;
    const res = await fetch(`/api/tags/${photo.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, source: 'manual' }),
    });
    if (res.ok) {
      const data = await res.json();
      setTags((prev) => [...prev.filter((t) => t.name !== data.name), { id: data.id, name: data.name, source: 'manual' }]);
      setNewTag('');
    }
  }

  async function removeTag(name: string) {
    const prevTags = tags;
    const removedTag = tags.find(t => t.name === name);
    if (removedTag?.source === 'ai') track('ai_tag_reviewed', { action: 'reject' });
    setTags((prev) => prev.filter((t) => t.name !== name));
    try {
      const res = await fetch(`/api/tags/${photo.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
    } catch (err) {
      console.error('[useTagEditor] removeTag failed:', err instanceof Error ? err.message : err);
      setTags(prevTags);
      showErrorToast('No se pudo eliminar la etiqueta. Inténtalo de nuevo.');
    }
  }

  function mergeAiTags(aiTagNames: string[]) {
    setTags((prev) => {
      const existing = new Set(prev.map((t) => t.name));
      const newAi = aiTagNames
        .filter((n) => !existing.has(n))
        .map((n, i) => ({ id: -(i + 1), name: n, source: 'ai' as const }));
      return [...prev, ...newAi];
    });
  }

  return { tags, newTag, setNewTag, addTag, removeTag, mergeAiTags, errorToast, showErrorToast };
}
