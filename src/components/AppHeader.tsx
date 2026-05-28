'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSearch, IconSparkle } from './Icons';
import { useSearchShortcut } from '@/hooks/useSearchShortcut';
import { classifyQuery } from '@/lib/search/classifier';
import type { ClassifierHints } from '@/lib/search/classifier';

// ─── Minimal hints fetch (lazy, once per mount) ───────────────────────────────

async function fetchHints(): Promise<ClassifierHints> {
  try {
    const res = await fetch('/api/search/hints', { credentials: 'same-origin' });
    if (!res.ok) return { tags: [], events: [] };
    return res.json() as Promise<ClassifierHints>;
  } catch {
    return { tags: [], events: [] };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppHeader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [hints, setHints] = useState<ClassifierHints>({ tags: [], events: [] });
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  // Load hints once on mount
  useEffect(() => {
    fetchHints().then(setHints);
  }, []);

  // ⌘K / Ctrl+K → focus the search input
  const focusInput = useCallback(() => {
    setIsMobileExpanded(true);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  useSearchShortcut(focusInput);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    const intent = classifyQuery(q, hints);
    // Navigate to unified search results page
    router.push(`/search?q=${encodeURIComponent(q)}&intent=${intent.type}`);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setValue('');
      inputRef.current?.blur();
      setIsMobileExpanded(false);
    }
  }

  // Preview intent badge (shown while typing)
  const liveIntent = value.trim() ? classifyQuery(value, hints) : null;
  const showAiBadge = liveIntent?.type === 'ai';

  return (
    <header className="app-header">
      {/* Logo zone */}
      <div className="app-header-logo">
        <span className="app-header-logo-text">photoshelf</span>
      </div>

      {/* Search zone */}
      <form
        className={`app-header-search${isMobileExpanded ? ' expanded' : ''}`}
        onSubmit={handleSubmit}
        role="search"
      >
        <IconSearch size={14} />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar fotos, tags, eventos… (⌘K)"
          className="app-header-input"
          autoComplete="off"
          spellCheck={false}
        />
        {showAiBadge && (
          <span className="app-header-ai-badge" title="Búsqueda inteligente con IA">
            <IconSparkle size={11} />
            <span>IA</span>
          </span>
        )}
      </form>

      {/* Actions zone (mobile: search toggle) */}
      <div className="app-header-actions">
        <button
          className="app-header-search-toggle"
          onClick={() => {
            setIsMobileExpanded(v => !v);
            if (!isMobileExpanded) setTimeout(() => inputRef.current?.focus(), 50);
          }}
          aria-label="Abrir buscador"
        >
          <IconSearch size={16} />
        </button>
      </div>
    </header>
  );
}
