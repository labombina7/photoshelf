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
  const inputRef       = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const formRef        = useRef<HTMLFormElement>(null);

  const [value,            setValue]            = useState('');
  const [hints,            setHints]            = useState<ClassifierHints>({ tags: [], events: [] });
  const [dropdownOpen,     setDropdownOpen]     = useState(false);
  const [focusedIndex,     setFocusedIndex]     = useState(-1);
  const [mobileSheetOpen,  setMobileSheetOpen]  = useState(false);

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

  // Close desktop dropdown when clicking outside
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

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    document.body.style.overflow = mobileSheetOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileSheetOpen]);

  // ⌘K / Ctrl+K → focus
  const focusInput = useCallback(() => {
    // On mobile, open the sheet
    if (window.matchMedia('(max-width: 640px)').matches) {
      setMobileSheetOpen(true);
      setTimeout(() => mobileInputRef.current?.focus(), 120);
    } else {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, []);
  useSearchShortcut(focusInput);

  // ─── Navigate helper ────────────────────────────────────────────────────────

  function navigate(q: string) {
    if (!q.trim()) return;
    const intent = classifyQuery(q, hints);
    pushHistory(q, intent.type);
    router.push(`/search?q=${encodeURIComponent(q)}&intent=${intent.type}`);
    setDropdownOpen(false);
    setFocusedIndex(-1);
    setMobileSheetOpen(false);
    setValue(q);
    inputRef.current?.blur();
    mobileInputRef.current?.blur();
  }

  // ─── Desktop submit ─────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const history = recent();
    if (focusedIndex >= 0 && focusedIndex < history.length) {
      navigate(history[focusedIndex].query);
      return;
    }
    navigate(value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (dropdownOpen) { setDropdownOpen(false); setFocusedIndex(-1); return; }
      setValue('');
      inputRef.current?.blur();
      return;
    }
    if (!dropdownOpen) return;
    const total = recent().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(i => Math.min(i + 1, total - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(i => Math.max(i - 1, -1)); }
  }

  // ─── Mobile sheet submit ────────────────────────────────────────────────────

  function handleMobileSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate(value);
  }

  function handleMobileKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setMobileSheetOpen(false);
      return;
    }
  }

  // ─── Live intent badge ─────────────────────────────────────────────────────
  const liveIntent  = value.trim() ? classifyQuery(value, hints) : null;
  const showAiBadge = liveIntent?.type === 'ai';

  return (
    <>
      {/* ── Desktop/global header ───────────────────────────────────────────── */}
      <header className="app-header">
        {/* Logo */}
        <div className="app-header-logo">
          <span className="app-header-logo-text">photoshelf</span>
        </div>

        {/* Desktop search */}
        <form
          ref={formRef}
          className="app-header-search"
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
            onClearHistory={clearHistory}
            focusedIndex={focusedIndex}
            setFocusedIndex={setFocusedIndex}
          />
        </form>

        {/* Slot + actions */}
        {slot && <div className="app-header-slot">{slot}</div>}
        <div className="app-header-actions" />
      </header>

      {/* ── Mobile: floating bottom search bar ─────────────────────────────── */}
      <button
        className="mobile-search-bar"
        onClick={() => {
          setMobileSheetOpen(true);
          setTimeout(() => mobileInputRef.current?.focus(), 120);
        }}
        aria-label="Abrir buscador"
        aria-haspopup="dialog"
      >
        <IconSearch size={16} />
        <span className="mobile-search-bar-label">
          {value || 'Buscar fotos, tags, eventos…'}
        </span>
        {showAiBadge && (
          <span className="mobile-search-bar-ai">
            <IconSparkle size={11} />
          </span>
        )}
      </button>

      {/* ── Mobile: bottom sheet ────────────────────────────────────────────── */}
      {mobileSheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="mobile-search-backdrop"
            onClick={() => setMobileSheetOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div
            className="mobile-search-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Buscador"
          >
            {/* Drag handle */}
            <div className="mobile-search-sheet-handle" />

            {/* Input row */}
            <form
              className="mobile-search-sheet-form"
              onSubmit={handleMobileSubmit}
              role="search"
            >
              <IconSearch size={16} />
              <input
                ref={mobileInputRef}
                type="search"
                value={value}
                onChange={e => { setValue(e.target.value); setFocusedIndex(-1); }}
                onKeyDown={handleMobileKeyDown}
                placeholder="Buscar fotos, tags, eventos…"
                className="mobile-search-sheet-input"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
              {showAiBadge && (
                <span className="app-header-ai-badge">
                  <IconSparkle size={11} />
                  <span>IA</span>
                </span>
              )}
              {value && (
                <button
                  type="button"
                  className="mobile-search-sheet-clear"
                  onClick={() => { setValue(''); mobileInputRef.current?.focus(); }}
                  aria-label="Borrar búsqueda"
                >
                  ✕
                </button>
              )}
            </form>

            {/* Suggestions inline */}
            <SearchDropdown
              open={true}
              query={value}
              history={recent()}
              onSelect={navigate}
              onClearHistory={clearHistory}
              focusedIndex={focusedIndex}
              setFocusedIndex={setFocusedIndex}
              inline={true}
            />
          </div>
        </>
      )}
    </>
  );
}
