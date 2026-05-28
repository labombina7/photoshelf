'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { HistoryEntry } from '@/hooks/useSearchHistory';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TagSuggestion   { name: string; count: number }
interface EventSuggestion { name: string; year: number; count: number }

export interface DropdownItem {
  kind: 'history' | 'tag' | 'event';
  label: string;
  sub?: string;
}

interface SearchDropdownProps {
  open: boolean;
  query: string;
  history: HistoryEntry[];
  onSelect: (value: string) => void;
  onClearHistory: () => void;
  /** Controlled focused index (-1 = none) */
  focusedIndex: number;
  setFocusedIndex: (i: number) => void;
}

// ─── Fetch suggestions with debounce ─────────────────────────────────────────

function useSuggestions(query: string) {
  const [tags,   setTags]   = useState<TagSuggestion[]>([]);
  const [events, setEvents] = useState<EventSuggestion[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (query.length < 2) { setTags([]); setEvents([]); return; }

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(query)}`,
          { credentials: 'same-origin' },
        );
        if (!res.ok) return;
        const json = await res.json() as { data: { tags: TagSuggestion[]; events: EventSuggestion[] } };
        setTags(json.data.tags);
        setEvents(json.data.events);
      } catch {}
    }, 200);

    return () => clearTimeout(timerRef.current);
  }, [query]);

  return { tags, events };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchDropdown({
  open,
  query,
  history,
  onSelect,
  onClearHistory,
  focusedIndex,
  setFocusedIndex,
}: SearchDropdownProps) {
  const { tags, events } = useSuggestions(query);

  // Build flat item list for keyboard navigation
  const items: DropdownItem[] = [
    ...history.map(h => ({ kind: 'history' as const, label: h.query, sub: h.intent })),
    ...tags.map(t   => ({ kind: 'tag'     as const, label: t.name, sub: `${t.count} foto${t.count !== 1 ? 's' : ''}` })),
    ...events.map(e => ({ kind: 'event'   as const, label: e.name, sub: `${e.year} · ${e.count} fotos` })),
  ];

  const hasContent = items.length > 0;

  if (!open || !hasContent) return null;

  const historyEnd = history.length;
  const tagsEnd    = historyEnd + tags.length;

  return (
    <ul
      className="search-dropdown"
      role="listbox"
      aria-label="Sugerencias de búsqueda"
      onMouseLeave={() => setFocusedIndex(-1)}
    >
      {/* ── History ── */}
      {history.length > 0 && (
        <>
          <li className="search-dropdown-section-label">
            Recientes
            <button className="search-dropdown-clear" onClick={onClearHistory} type="button">
              Borrar
            </button>
          </li>
          {history.map((h, i) => (
            <li
              key={`h-${h.query}`}
              role="option"
              aria-selected={focusedIndex === i}
              className={`search-dropdown-item${focusedIndex === i ? ' focused' : ''}`}
              onMouseEnter={() => setFocusedIndex(i)}
              onMouseDown={e => { e.preventDefault(); onSelect(h.query); }}
            >
              <span className="search-dropdown-icon search-dropdown-icon--history">
                <ClockIcon />
              </span>
              <span className="search-dropdown-label">{h.query}</span>
              <span className="search-dropdown-sub">{intentLabel(h.intent)}</span>
            </li>
          ))}
        </>
      )}

      {/* ── Tags ── */}
      {tags.length > 0 && (
        <>
          <li className="search-dropdown-section-label">Tags</li>
          {tags.map((t, i) => {
            const idx = historyEnd + i;
            return (
              <li
                key={`t-${t.name}`}
                role="option"
                aria-selected={focusedIndex === idx}
                className={`search-dropdown-item${focusedIndex === idx ? ' focused' : ''}`}
                onMouseEnter={() => setFocusedIndex(idx)}
                onMouseDown={e => { e.preventDefault(); onSelect(t.name); }}
              >
                <span className="search-dropdown-icon search-dropdown-icon--tag">#</span>
                <span className="search-dropdown-label">{t.name}</span>
                <span className="search-dropdown-sub">{t.count} foto{t.count !== 1 ? 's' : ''}</span>
              </li>
            );
          })}
        </>
      )}

      {/* ── Events ── */}
      {events.length > 0 && (
        <>
          <li className="search-dropdown-section-label">Eventos</li>
          {events.map((e, i) => {
            const idx = tagsEnd + i;
            return (
              <li
                key={`e-${e.year}-${e.name}`}
                role="option"
                aria-selected={focusedIndex === idx}
                className={`search-dropdown-item${focusedIndex === idx ? ' focused' : ''}`}
                onMouseEnter={() => setFocusedIndex(idx)}
                onMouseDown={e2 => { e2.preventDefault(); onSelect(e.name); }}
              >
                <span className="search-dropdown-icon search-dropdown-icon--event">📅</span>
                <span className="search-dropdown-label">{e.name}</span>
                <span className="search-dropdown-sub">{e.year} · {e.count} fotos</span>
              </li>
            );
          })}
        </>
      )}
    </ul>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function intentLabel(intent: string): string {
  switch (intent) {
    case 'year':     return 'Año';
    case 'tag':      return 'Tag';
    case 'event':    return 'Evento';
    case 'ai':       return 'IA';
    case 'fulltext': return 'Texto';
    default:         return '';
  }
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

/** Exported so AppHeader can call this for keyboard nav */
export function getItemCount(history: HistoryEntry[], tags: number, events: number) {
  return history.length + tags + events;
}
