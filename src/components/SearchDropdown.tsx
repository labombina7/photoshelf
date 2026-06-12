'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSmartAlbum, IconFolder } from '@/components/Icons';
import type { HistoryEntry } from '@/hooks/useSearchHistory';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TagSuggestion        { name: string; count: number }
interface EventSuggestion      { name: string; year: number; count: number }
interface SmartAlbumSuggestion { id: number; name: string }
interface ProjectSuggestion    { id: number; title: string }

export interface DropdownItem {
  kind: 'history' | 'tag' | 'event' | 'smart_album' | 'project';
  label: string;
  sub?: string;
  /** Para smart_album y project: navegar directo en lugar de buscar */
  href?: string;
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
  /** Modo inline: sin position:absolute, para usar dentro del bottom sheet móvil */
  inline?: boolean;
}

// ─── Fetch suggestions with debounce ─────────────────────────────────────────

function useSuggestions(query: string) {
  const [tags,        setTags]        = useState<TagSuggestion[]>([]);
  const [events,      setEvents]      = useState<EventSuggestion[]>([]);
  const [smartAlbums, setSmartAlbums] = useState<SmartAlbumSuggestion[]>([]);
  const [projects,    setProjects]    = useState<ProjectSuggestion[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (query.length < 2) {
      setTags([]); setEvents([]); setSmartAlbums([]); setProjects([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(query)}`,
          { credentials: 'same-origin' },
        );
        if (!res.ok) return;
        const json = await res.json() as {
          data: {
            tags: TagSuggestion[];
            events: EventSuggestion[];
            smartAlbums: SmartAlbumSuggestion[];
            projects: ProjectSuggestion[];
          }
        };
        setTags(json.data.tags);
        setEvents(json.data.events);
        setSmartAlbums(json.data.smartAlbums ?? []);
        setProjects(json.data.projects ?? []);
      } catch {}
    }, 200);

    return () => clearTimeout(timerRef.current);
  }, [query]);

  return { tags, events, smartAlbums, projects };
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
  inline = false,
}: SearchDropdownProps) {
  const router = useRouter();
  const { tags, events, smartAlbums, projects } = useSuggestions(query);

  // Build flat item list for keyboard navigation
  const items: DropdownItem[] = [
    ...history.map(h => ({ kind: 'history' as const, label: h.query, sub: h.intent })),
    ...tags.map(t        => ({ kind: 'tag'         as const, label: t.name,    sub: `${t.count} foto${t.count !== 1 ? 's' : ''}` })),
    ...events.map(e      => ({ kind: 'event'       as const, label: e.name,    sub: `${e.year} · ${e.count} fotos` })),
    ...smartAlbums.map(a => ({ kind: 'smart_album' as const, label: a.name,    href: `/smart-albums/${a.id}` })),
    ...projects.map(p    => ({ kind: 'project'     as const, label: p.title,   href: `/projects/${p.id}` })),
  ];

  const hasContent = items.length > 0;

  if (!open || !hasContent) return null;

  const historyEnd    = history.length;
  const tagsEnd       = historyEnd + tags.length;
  const eventsEnd     = tagsEnd + events.length;
  const albumsEnd     = eventsEnd + smartAlbums.length;

  return (
    <ul
      className={`search-dropdown${inline ? ' search-dropdown--inline' : ''}`}
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

      {/* ── Smart Albums ── */}
      {smartAlbums.length > 0 && (
        <>
          <li className="search-dropdown-section-label">Carpetas inteligentes</li>
          {smartAlbums.map((a, i) => {
            const idx = eventsEnd + i;
            return (
              <li
                key={`sa-${a.id}`}
                role="option"
                aria-selected={focusedIndex === idx}
                className={`search-dropdown-item${focusedIndex === idx ? ' focused' : ''}`}
                onMouseEnter={() => setFocusedIndex(idx)}
                onMouseDown={e => { e.preventDefault(); router.push(`/smart-albums/${a.id}`); }}
              >
                <span className="search-dropdown-icon search-dropdown-icon--album"><IconSmartAlbum size={14} /></span>
                <span className="search-dropdown-label">{a.name}</span>
              </li>
            );
          })}
        </>
      )}

      {/* ── Projects ── */}
      {projects.length > 0 && (
        <>
          <li className="search-dropdown-section-label">Proyectos</li>
          {projects.map((p, i) => {
            const idx = albumsEnd + i;
            return (
              <li
                key={`pr-${p.id}`}
                role="option"
                aria-selected={focusedIndex === idx}
                className={`search-dropdown-item${focusedIndex === idx ? ' focused' : ''}`}
                onMouseEnter={() => setFocusedIndex(idx)}
                onMouseDown={e => { e.preventDefault(); router.push(`/projects/${p.id}`); }}
              >
                <span className="search-dropdown-icon search-dropdown-icon--project"><IconFolder size={14} /></span>
                <span className="search-dropdown-label">{p.title}</span>
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
export function getItemCount(history: HistoryEntry[], tags: number, events: number, smartAlbums = 0, projects = 0) {
  return history.length + tags + events + smartAlbums + projects;
}
