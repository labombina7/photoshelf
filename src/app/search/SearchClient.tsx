'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconSparkle, IconMenu } from '@/components/Icons';
import { useHeaderSlot } from '@/components/HeaderSlot';
import { useAnalytics } from '@/hooks/useAnalytics';
import { DeepSearchPanel } from './DeepSearchPanel';
import { SaveThemePanel } from './SaveThemePanel';
import type { SearchResult, SearchPhotoRow, TagMatch, EventMatch, SmartAlbumMatch, ProjectMatch } from '@/lib/search/execute';

// ─── Sync header ──────────────────────────────────────────────────────────────

function HeaderQuerySync({ query }: { query: string }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('photoshelf:search-sync', { detail: query }));
  }, [query]);
  return null;
}

// ─── Photo grid ───────────────────────────────────────────────────────────────

function SearchPhotoGrid({ photos }: { photos: SearchPhotoRow[] }) {
  const { track } = useAnalytics();
  if (photos.length === 0) return null;
  return (
    <div className="photo-grid">
      {photos.map(photo => (
        <Link
          key={photo.id}
          href={`/library/${photo.id}`}
          className="photo-item"
          aria-label={photo.filename}
          onClick={() => track('search_result_clicked', { photo_id: photo.id })}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/photos/${photo.id}/thumbnail?size=300`} alt={photo.filename} loading="lazy" />
        </Link>
      ))}
    </div>
  );
}

// ─── Tags & Events ────────────────────────────────────────────────────────────

function TagsSection({ tags }: { tags: TagMatch[] }) {
  if (tags.length === 0) return null;
  return (
    <section className="search-results-section">
      <h2 className="search-results-section-title">Tags</h2>
      <div className="search-tags-row">
        {tags.map(tag => (
          <Link key={tag.name} href={`/tags/${encodeURIComponent(tag.name)}`} className="search-tag-chip">
            {tag.name}
            <span className="search-tag-count">{tag.count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

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

function SmartAlbumsSection({ smartAlbums }: { smartAlbums: SmartAlbumMatch[] }) {
  if (smartAlbums.length === 0) return null;
  return (
    <section className="search-results-section">
      <h2 className="search-results-section-title">Carpetas inteligentes</h2>
      <ul className="search-events-list">
        {smartAlbums.map(album => (
          <li key={album.id} className="search-event-item">
            <Link href={`/smart-albums/${album.id}`}>
              <span className="search-event-name">📂 {album.name}</span>
              <span className="search-event-meta">{album.photo_count} foto{album.photo_count !== 1 ? 's' : ''}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProjectsSection({ projects }: { projects: ProjectMatch[] }) {
  if (projects.length === 0) return null;
  return (
    <section className="search-results-section">
      <h2 className="search-results-section-title">Proyectos</h2>
      <ul className="search-events-list">
        {projects.map(project => (
          <li key={project.id} className="search-event-item">
            <Link href={`/projects/${project.id}`}>
              <span className="search-event-name">🗂️ {project.title}</span>
              <span className="search-event-meta">{project.photo_count} foto{project.photo_count !== 1 ? 's' : ''}</span>
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
        <button className="search-empty-ai-btn" onClick={() => router.push(`/search?q=${encodeURIComponent(query)}&mode=ai`)}>
          <IconSparkle size={13} />
          Buscar con IA
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SearchClient({ result }: { result: SearchResult }) {
  const router = useRouter();
  const { query, intent, isAI, aiConcept, photos, tags, events, smartAlbums, projects, total, duration_ms } = result;

  const hasSections = (photos.length > 0 ? 1 : 0) + (tags.length > 0 ? 1 : 0) + (events.length > 0 ? 1 : 0) > 1;
  const isEmpty     = total === 0 && tags.length === 0 && events.length === 0 && smartAlbums.length === 0 && projects.length === 0;

  // ── Slot mobile: botón atrás + título ───────────────────────────────────────
  useHeaderSlot(useMemo(() => (
    <div className="header-slot-library">
      <button
        className="header-slot-hamburger"
        onClick={() => window.dispatchEvent(new CustomEvent('photoshelf:sidebar-open'))}
        aria-label="Abrir menú"
        title="Menú"
      >
        <IconMenu size={18} />
      </button>
      <span className="header-slot-title">Búsqueda</span>
      {total > 0 && (
        <span className="header-slot-sub">{total} foto{total !== 1 ? 's' : ''}</span>
      )}
    </div>
  ), [total]));

  return (
    <>
      <HeaderQuerySync query={query} />

      {/* Results header */}
      <div className="search-results-header">
        <h1 className="search-results-title">
          {isEmpty
            ? <>Sin resultados para <em>"{query}"</em></>
            : <>Resultados para <em>"{query}"</em></>}
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

      {/* AI concept line */}
      {isAI && aiConcept && (
        <p className="search-ai-concept">
          La IA interpretó tu búsqueda como: <em>"{aiConcept}"</em>
        </p>
      )}

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

          <TagsSection tags={tags} />
          <EventsSection events={events} />
          <SmartAlbumsSection smartAlbums={smartAlbums} />
          <ProjectsSection projects={projects} />

          {/* Save as theme — only for AI results */}
          {isAI && <SaveThemePanel photoIds={photos.map(p => p.id)} />}
        </div>
      )}

      {/* Deep AI search panel — always show when intent is AI */}
      {intent === 'ai' && <DeepSearchPanel query={query} />}

      {/* Footer: duration */}
      <p className="search-results-footer">
        Búsqueda completada en {(duration_ms / 1000).toFixed(1)}s
      </p>
    </>
  );
}
