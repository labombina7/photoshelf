'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconSparkle } from '@/components/Icons';
import type { SearchResult, SearchPhotoRow, TagMatch, EventMatch } from '@/lib/search/execute';

// ─── Sync header ──────────────────────────────────────────────────────────────

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
        <Link key={photo.id} href={`/library/${photo.id}`} className="photo-item" aria-label={photo.filename}>
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

// ─── Deep AI search ───────────────────────────────────────────────────────────

interface DeepResult {
  id: number; filename: string; year: number; event: string; taken_at: string | null; is_favorite: number;
}

function DeepSearchPanel({ query }: { query: string }) {
  const [running,   setRunning]   = useState(false);
  const [analyzed,  setAnalyzed]  = useState(0);
  const [totalCand, setTotalCand] = useState(0);
  const [photos,    setPhotos]    = useState<DeepResult[]>([]);
  const [offset,    setOffset]    = useState(0);
  const [hasMore,   setHasMore]   = useState(false);
  const [done,      setDone]      = useState(false);

  async function runBatch(currentOffset: number) {
    setRunning(true);
    try {
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, mode: 'deep', offset: currentOffset }),
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const data = await res.json() as {
        photos: DeepResult[]; analyzed: number; next_offset: number;
        total_candidates: number; has_more: boolean;
      };
      setPhotos(prev => [...prev, ...data.photos]);
      setAnalyzed(currentOffset + data.analyzed);
      setTotalCand(data.total_candidates);
      setOffset(data.next_offset);
      setHasMore(data.has_more);
      if (!data.has_more) setDone(true);
    } finally {
      setRunning(false);
    }
  }

  if (done && photos.length === 0) return (
    <p className="search-deep-empty">El análisis visual no encontró coincidencias.</p>
  );

  return (
    <section className="search-results-section">
      <h2 className="search-results-section-title">
        Análisis visual IA
        {running && <span className="search-deep-spinner" />}
      </h2>

      {photos.length > 0 && <SearchPhotoGrid photos={photos} />}

      {!running && !done && (
        <button
          className="search-deep-btn"
          onClick={() => runBatch(offset)}
        >
          <IconSparkle size={12} />
          {photos.length === 0
            ? 'Analizar fotos con visión IA (más lento)'
            : `Analizar ${Math.min(50, totalCand - analyzed)} más`}
        </button>
      )}

      {running && (
        <div className="search-deep-progress">
          <div className="search-deep-progress-bar">
            <div
              className="search-deep-progress-fill"
              style={{ width: totalCand > 0 ? `${Math.round((analyzed / totalCand) * 100)}%` : '0%' }}
            />
          </div>
          <span className="search-deep-progress-label">
            Analizando {analyzed}/{totalCand} fotos…
          </span>
        </div>
      )}
    </section>
  );
}

// ─── Save as theme ────────────────────────────────────────────────────────────

function SaveThemePanel({ photoIds }: { photoIds: number[] }) {
  const router = useRouter();
  const [name,    setName]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  if (photoIds.length === 0) return null;

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res  = await fetch('/api/themes', {
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

  return (
    <div className="search-save-theme">
      <span className="search-save-theme-label">Guardar como temática</span>
      <input
        className="search-save-theme-input"
        placeholder="Nombre de la temática…"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
      />
      <button
        className="search-save-theme-btn"
        onClick={handleSave}
        disabled={saving || !name.trim()}
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
      {savedMsg && <span className="search-save-theme-msg">{savedMsg}</span>}
    </div>
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
  const { query, intent, isAI, aiConcept, photos, tags, events, total, duration_ms } = result;

  const hasSections = (photos.length > 0 ? 1 : 0) + (tags.length > 0 ? 1 : 0) + (events.length > 0 ? 1 : 0) > 1;
  const isEmpty     = total === 0 && tags.length === 0 && events.length === 0;

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
