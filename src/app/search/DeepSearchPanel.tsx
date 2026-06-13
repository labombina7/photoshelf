'use client';

import { IconSparkle } from '@/components/Icons';
import { useAiSearch } from '@/hooks/useAiSearch';
import { useAnalytics } from '@/hooks/useAnalytics';
import Link from 'next/link';

interface DeepResult {
  id: number; filename: string; year: number; event: string; taken_at: string | null; is_favorite: number;
}

function DeepPhotoGrid({ photos }: { photos: DeepResult[] }) {
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
          <img
            src={`/api/photos/${photo.id}/thumbnail?size=300`}
            alt={photo.filename}
            ref={el => { if (el?.complete) el.classList.add('loaded'); }}
            onLoad={e => (e.currentTarget as HTMLImageElement).classList.add('loaded')}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </Link>
      ))}
    </div>
  );
}

export function DeepSearchPanel({ query }: { query: string }) {
  const { running, analyzed, totalCand, photos, offset, done, runBatch } = useAiSearch(query);

  if (done && photos.length === 0) return (
    <p className="search-deep-empty">El análisis visual no encontró coincidencias.</p>
  );

  return (
    <section className="search-results-section">
      <h2 className="search-results-section-title">
        Análisis visual IA
        {running && <span className="search-deep-spinner" />}
      </h2>

      {photos.length > 0 && <DeepPhotoGrid photos={photos} />}

      {!running && !done && (
        <button className="search-deep-btn" onClick={() => runBatch(offset)}>
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
