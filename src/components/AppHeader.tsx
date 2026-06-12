'use client';

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { IconSearch, IconSparkle, IconGear } from './Icons';
import { useSearchShortcut } from '@/hooks/useSearchShortcut';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { classifyQuery } from '@/lib/search/classifier';
import type { ClassifierHints } from '@/lib/search/classifier';
import { HeaderSlotCtx } from './HeaderSlot';
import SearchDropdown from './SearchDropdown';
import { useAnalytics } from '@/hooks/useAnalytics';

const NAV_MODULES = [
  { href: '/library',      label: 'Catálogo',     match: (p: string) => p === '/library' || p.startsWith('/library/') || p === '/timeline' || p === '/map' || p === '/memories' || p.startsWith('/tags') || p === '/search' },
  { href: '/projects',     label: 'Proyectos',    match: (p: string) => p === '/projects' || p.startsWith('/projects/') },
  { href: '/smart-albums', label: 'Álbumes',      match: (p: string) => p === '/smart-albums' || p.startsWith('/smart-albums/') },
  { href: '/insights',     label: 'Análisis',     match: (p: string) => p === '/insights' || p.startsWith('/insights/') || p === '/stats' || p.startsWith('/stats/') },
  { href: '/jobs',         label: 'Herramientas', match: (p: string) => ['/jobs', '/health', '/about'].some(r => p === r || p.startsWith(r + '/')) || p.startsWith('/tools') },
] as const;

// ─── Hints fetch (lazy, once per mount) ──────────────────────────────────────

async function fetchHints(): Promise<ClassifierHints> {
  try {
    const res = await fetch('/api/search/hints', { credentials: 'same-origin' });
    if (!res.ok) return { tags: [], events: [], smartAlbums: [], projects: [] };
    return res.json() as Promise<ClassifierHints>;
  } catch {
    return { tags: [], events: [], smartAlbums: [], projects: [] };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppHeader() {
  const router   = useRouter();
  const pathname = usePathname();
  const { slot, slotLeft } = useContext(HeaderSlotCtx);
  const inputRef       = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const formRef        = useRef<HTMLFormElement>(null);

  const [value,            setValue]            = useState('');
  const [hints,            setHints]            = useState<ClassifierHints>({ tags: [], events: [], smartAlbums: [], projects: [] });
  const [dropdownOpen,     setDropdownOpen]     = useState(false);
  const [focusedIndex,     setFocusedIndex]     = useState(-1);
  const [mobileSheetOpen,  setMobileSheetOpen]  = useState(false);
  const [searchShortcut,   setSearchShortcut]   = useState('⌘K');
  const [selectionActive,  setSelectionActive]  = useState(false);

  const { recent, push: pushHistory, clear: clearHistory } = useSearchHistory();
  const { track } = useAnalytics();

  // Load hints once on mount
  useEffect(() => {
    fetchHints().then(setHints);
  }, []);

  // Detect OS to show correct keyboard shortcut
  useEffect(() => {
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform) || navigator.userAgent.includes('Mac');
    setSearchShortcut(isMac ? '⌘K' : 'Ctrl+K');
  }, []);

  // Sync input value when /search page dispatches a sync event
  useEffect(() => {
    function onSync(e: Event) {
      setValue((e as CustomEvent<string>).detail);
    }
    window.addEventListener('photoshelf:search-sync', onSync);
    return () => window.removeEventListener('photoshelf:search-sync', onSync);
  }, []);

  // Ocultar FAB cuando el modo selección está activo en LibraryClient
  useEffect(() => {
    function onSelection(e: Event) {
      setSelectionActive((e as CustomEvent<boolean>).detail);
    }
    window.addEventListener('photoshelf:selection-mode', onSelection);
    return () => window.removeEventListener('photoshelf:selection-mode', onSelection);
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

  // Lock body scroll when mobile sheet is open (iOS-safe technique)
  useEffect(() => {
    if (mobileSheetOpen) {
      const scrollY = window.scrollY;
      document.body.style.cssText = `overflow:hidden;position:fixed;top:-${scrollY}px;width:100%`;
      document.body.dataset.scrollY = String(scrollY);
    } else {
      const scrollY = parseInt(document.body.dataset.scrollY ?? '0', 10);
      document.body.style.cssText = '';
      delete document.body.dataset.scrollY;
      window.scrollTo(0, scrollY);
    }
    return () => {
      const scrollY = parseInt(document.body.dataset.scrollY ?? '0', 10);
      document.body.style.cssText = '';
      delete document.body.dataset.scrollY;
      if (scrollY) window.scrollTo(0, scrollY);
    };
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
    track('search_performed', { query_length: q.trim().length, intent: intent.type });
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

        {/* Nav módulos globales */}
        <nav className="app-header-nav" aria-label="Módulos">
          {NAV_MODULES.map(({ href, label, match }) => (
            <Link
              key={href}
              href={href}
              className={`app-header-nav-item${match(pathname) ? ' active' : ''}`}
            >
              {label}
            </Link>
          ))}
          {/* Separador + icono de ajustes — al final de la nav, a la derecha de Herramientas */}
          <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 6px', alignSelf: 'center', flexShrink: 0 }} aria-hidden="true" />
          <Link
            href="/settings"
            className={`app-header-nav-item app-header-settings-btn${pathname.startsWith('/settings') ? ' active' : ''}`}
            title="Ajustes"
            aria-label="Ajustes"
          >
            <IconGear size={16} />
          </Link>
        </nav>

        {/* Slot izquierda — siempre en DOM para mantener grid estable */}
        <div className="app-header-slot-left">{slotLeft}</div>

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
            placeholder={`Buscar fotos, tags, eventos… (${searchShortcut})`}
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

        {/* Slot derecha — siempre en DOM para mantener grid estable */}
        <div className="app-header-slot-right">{slot}</div>
      </header>

      {/* ── Mobile: nav módulos secundaria ─────────────────────────────────── */}
      <nav className="app-nav-mobile" aria-label="Módulos">
        {NAV_MODULES.map(({ href, label, match }) => (
          <Link
            key={href}
            href={href}
            className={`app-nav-mobile-item${match(pathname) ? ' active' : ''}`}
          >
            {label}
          </Link>
        ))}
        <Link
          href="/settings"
          className={`app-nav-mobile-item${pathname.startsWith('/settings') ? ' active' : ''}`}
          aria-label="Ajustes"
        >
          <IconGear size={15} />
        </Link>
      </nav>

      {/* ── Mobile: floating search FAB ─────────────────────────────────────── */}
      <button
        className={`mobile-search-fab${mobileSheetOpen || selectionActive ? ' mobile-search-fab--hidden' : ''}`}
        onClick={() => {
          setMobileSheetOpen(true);
          setTimeout(() => mobileInputRef.current?.focus(), 120);
        }}
        aria-label="Abrir buscador"
        aria-haspopup="dialog"
      >
        <IconSearch size={20} />
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

          {/* Sheet — flex column: suggestions fill top, input pinned to bottom */}
          <div
            className="mobile-search-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Buscador"
          >
            {/* Suggestions scroll area (above input) */}
            <div className="mobile-search-sheet-suggestions">
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

            {/* Drag handle (above input) */}
            <div className="mobile-search-sheet-handle" />

            {/* Input row — pinned at bottom */}
            <form
              className="mobile-search-sheet-form"
              onSubmit={handleMobileSubmit}
              role="search"
            >
              <IconSearch size={16} />
              <input
                ref={mobileInputRef}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                value={value}
                onChange={e => { setValue(e.target.value); setFocusedIndex(-1); }}
                onKeyDown={handleMobileKeyDown}
                placeholder="Buscar fotos, tags, eventos…"
                className="mobile-search-sheet-input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
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
          </div>
        </>
      )}
    </>
  );
}
