'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function useThemeEditor(photoIds: number[]) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  async function saveTheme() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color: '#3b62d4' }),
      });
      const theme = await res.json() as { id: number };
      await Promise.all(photoIds.map(id =>
        fetch(`/api/photo-themes/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ themeId: theme.id }),
        })
      ));
      setSavedMsg(`Temática "${name}" guardada con ${photoIds.length} fotos`);
      setTimeout(() => setSavedMsg(''), 5000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return { name, setName, saving, savedMsg, saveTheme };
}
