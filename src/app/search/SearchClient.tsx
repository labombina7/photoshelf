'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { IconSparkle } from '@/components/Icons';
import type { SearchResult, SearchPhotoRow, TagMatch, EventMatch } from '@/lib/search/execute';

// ─── Sync header search bar with current query ────────────────────────────────

/**
 * Syncs the AppHeader input with the current search query.
 * The AppHeader owns its own state; we dispatch a custom event that it listens to.
 */
function HeaderQuerySync({ query }: { query: string }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('photoshelf:search-sync', { detail: query }));
  }, [query]);
  return null;
}

// ─── Photo grid ───────────────────────────────────────────────────────────────

function SearchPhotoGrid({ photos }: { photos: SearchPhotoRow[] }) {
  if (photos.length === 0) return null;
  return (
    <div className="photo-grid">
      {photos.map(photo => (
        <Link
          key={photo.id}
          href={`/library/${photo.id}`}
          className="photo-item"
          aria-label={photo.filename}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/photos/${photo.id}/thumbnail?size=300`}
            alt={photo.filename}
            loading="lazy"
          />
        </Link>
      ))}
    </div>
  );
}

// ─── Tags section ─────────────────────────────────────────────────────────────

function TagsSection({ tags }: { tags: TagMatch[] }) {
  if (tags.length === 0) return null;
  return (
    <section className="search-results-section">
      <h2 className="search-results-section-title">Tags</h2>
      <div className="search-tags-row">
        {tags.map(tag => (
          <Link
            key={tag.name}
            href={`/tags/${encodeURIComponent(tag.name)}`}
            className="search-tag-chip"
          >
            {tag.name}
            <span className="search-tag-count">{tag.count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── Events section ───────────────────────────────────────────────────────────

function EventsSection({ events }: { events: EventMatch[] }) {
  if (events.length === 0) return null;
  return (
    <section className="search-results-section">
      <h2 className="search-results-section-title">Eventos</h2>
      <ul className="search-events-list">
        {events.map(ev => (
          <li key={`${ev.year}-${ev.event}`} className="search-event-item">
            <Link href={`/library?year=${ev.year}&event=${encodeURIComponent(ev.event)}`}>
              <span className="search-event-name">{ev.event}</span>
              <span className="search-event-meta">{ev.year} · {ev.count} foto{ev.count !== 1 ? 's' : ''}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyResult({ query, isAI }: { query: string; isAI: boolean }) {
  const router = useRouter();
  return (
    <div className="search-empty" aria-live="polite">
      <p className="search-empty-title">No encontramos nada para <em>"{query}"</em></p>
      <p className="search-empty-hint">Prueba con menos palabras o términos más generales.</p>
      {!isAI && (
        <button
          className="search-empty-ai-btn"
          onClick={() => router.push(`/search?q=${encodeURIComponent(query)}&intent=ai`)}
        >
          <IconSparkle size={13} />
          Buscar con IA
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SearchClientProps {
  result: SearchResult;
}

export default function SearchClient({ result }: SearchClientProps) {
  const { query, intent, isAI, photos, tags, events, total } = result;

  const hasSections = (photos.length > 0 ? 1 : 0) + (tags.length > 0 ? 1 : 0) + (events.length > 0 ? 1 : 0) > 1;
  const isEmpty = total === 0 && tags.length === 0 && events.length === 0;

  return (
    <>
      <HeaderQuerySync query={query} />

      {/* Results header */}
      <div className="search-results-header">
        <h1 className="search-results-title">
          {isEmpty
            ? <>Sin resultados para <em>"{query}"</em></>
            : <>Resultados para <em>"{query}"</em></>
          }
        </h1>
        {!isEmpty && (
          <div className="search-results-meta">
            {total > 0 && <span>{total} foto{total !== 1 ? 's' : ''}</span>}
            {isAI && (
              <span className="search-ai-badge">
                <IconSparkle size={11} />
                Búsqueda IA
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {isEmpty ? (
        <EmptyResult query={query} isAI={isAI} />
      ) : (
        <div className="search-results-body">
          {/* Photos */}
          {photos.length > 0 && (
            <section className="search-results-section">
              {hasSections && <h2 className="search-results-section-title">Fotos</h2>}
              <SearchPhotoGrid photos={photos} />
            </section>
          )}

          {/* Tags */}
          <TagsSection tags={tags} />

          {/* Events */}
          <EventsSection events={events} />
        </div>
      )}
    </>
  );
}
