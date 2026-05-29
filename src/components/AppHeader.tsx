'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSearch, IconSparkle } from './Icons';
import { useSearchShortcut } from '@/hooks/useSearchShortcut';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { classifyQuery } from '@/lib/search/classifier';
import type { ClassifierHints } from '@/lib/search/classifier';
import { HeaderSlotCtx } from './HeaderSlot';
import SearchDropdown from './SearchDropdown';

// ─── Hints fetch (lazy, once per mount) ──────────────────────────────────────

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
  const router   = useRouter();
  const { slot } = useContext(HeaderSlotCtx);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef  = useRef<HTMLFormElement>(null);

  const [value,            setValue]            = useState('');
  const [hints,            setHints]            = useState<ClassifierHints>({ tags: [], events: [] });
  const [dropdownOpen,     setDropdownOpen]     = useState(false);
  const [focusedIndex,     setFocusedIndex]     = useState(-1);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const { recent, push: pushHistory, clear: clearHistory } = useSearchHistory();

  // Load hints once on mount
  useEffect(() => {
    fetchHints().then(setHints);
  }, []);

  // Sync input value when /search page dispatches a sync event
  useEffect(() => {
    function onSync(e: Event) {
      setValue((e as CustomEvent<string>).detail);
    }
    window.addEventListener('photoshelf:search-sync', onSync);
    return () => window.removeEventListener('photoshelf:search-sync', onSync);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!formRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
        setFocusedIndex(-1);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // ⌘K / Ctrl+K → focus
  const focusInput = useCallback(() => {
    setIsMobileExpanded(true);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  useSearchShortcut(focusInput);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function navigate(q: string) {
    if (!q.trim()) return;
    const intent = classifyQuery(q, hints);
    pushHistory(q, intent.type);
    router.push(`/search?q=${encodeURIComponent(q)}&intent=${intent.type}`);
    setDropdownOpen(false);
    setFocusedIndex(-1);
    inputRef.current?.blur();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // If an item is focused in the dropdown, select it
    const history = recent();
    if (focusedIndex >= 0) {
      const allItems = [
        ...history.map(h => h.query),
      ];
      if (focusedIndex < allItems.length) {
        navigate(allItems[focusedIndex]);
        return;
      }
    }
    navigate(value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (dropdownOpen) { setDropdownOpen(false); setFocusedIndex(-1); return; }
      setValue('');
      inputRef.current?.blur();
      setIsMobileExpanded(false);
      return;
    }
    if (!dropdownOpen) return;

    const history = recent();
    // Approximate total — we don't know suggestion count here; keyboard nav on history only for now
    const total = history.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => Math.min(i + 1, total - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => Math.max(i - 1, -1));
    }
  }

  // ─── Live intent badge ─────────────────────────────────────────────────────
  const liveIntent  = value.trim() ? classifyQuery(value, hints) : null;
  const showAiBadge = liveIntent?.type === 'ai';

  return (
    <header className="app-header">
      {/* Logo */}
      <div className="app-header-logo">
        <span className="app-header-logo-text">photoshelf</span>
      </div>

      {/* Search */}
      <form
        ref={formRef}
        className={`app-header-search${isMobileExpanded ? ' expanded' : ''}`}
        onSubmit={handleSubmit}
        role="search"
        style={{ position: 'relative' }}
      >
        <IconSearch size={14} />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={e => { setValue(e.target.value); setFocusedIndex(-1); }}
          onFocus={() => setDropdownOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar fotos, tags, eventos… (⌘K)"
          className="app-header-input"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
        {showAiBadge && (
          <span className="app-header-ai-badge" title="Búsqueda inteligente con IA">
            <IconSparkle size={11} />
            <span>IA</span>
          </span>
        )}

        <SearchDropdown
          open={dropdownOpen}
          query={value}
          history={recent()}
          onSelect={navigate}
          onClearHistory={() => { clearHistory(); }}
          focusedIndex={focusedIndex}
          setFocusedIndex={setFocusedIndex}
        />
      </form>

      {/* Slot — contenido contextual de la página activa */}
      {slot && <div className="app-header-slot">{slot}</div>}

      {/* Actions — el toggle se renderiza siempre; en desktop está oculto por CSS */}
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
