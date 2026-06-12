'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useTagEditor } from '@/hooks/useTagEditor';
import { useAiReview } from '@/hooks/useAiReview';
import {
  IconX, IconSparkle, IconCheck, IconCalendar,
  IconCamera, IconMap, IconFile, IconAperture, IconStar, IconEye,
} from './Icons';
import { Button } from './ui/Button';
import type { PhotoDetail, Theme } from '@/lib/types';
import type { PhotoReview } from '@/lib/ollama';

interface DetailPanelProps {
  photo: PhotoDetail;
  allThemes: Theme[];
}

function ReviewModal({ review, error, onClose }: {
  review: PhotoReview | null;
  error: string | null;
  onClose: () => void;
}) {
  if (!review && !error) return null;
  return (
    <>
      <div className="review-overlay" onClick={onClose} />
      <div className="review-modal">
        <div className="review-modal-header">
          <span style={{ fontWeight: 600, fontSize: 14 }}>Análisis de la imagen</span>
          <button className="ai-panel-close" onClick={onClose} aria-label="Cerrar análisis de IA">
            <IconX size={14} />
          </button>
        </div>
        <div className="review-modal-body">
          {error && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              No se pudo analizar la imagen: <strong>{error}</strong>
            </p>
          )}
          {review && (
            <>
              {review.score > 0 && (
                <div className="review-score">
                  <span className="review-score-num">{review.score}</span>
                  <span className="review-score-label">/10</span>
                  <div className="review-score-bar">
                    <div className="review-score-fill" style={{ width: `${review.score * 10}%` }} />
                  </div>
                </div>
              )}
              {review.summary && <p className="review-summary">{review.summary}</p>}
              {review.composition && (
                <div className="review-row">
                  <span className="review-row-label">Composición</span>
                  <span className="review-row-value">{review.composition}</span>
                </div>
              )}
              {review.light && (
                <div className="review-row">
                  <span className="review-row-label">Luz</span>
                  <span className="review-row-value">{review.light}</span>
                </div>
              )}
              {review.strengths.length > 0 && (
                <div className="review-row">
                  <span className="review-row-label">Puntos fuertes</span>
                  <ul className="review-list review-list--positive">
                    {review.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {review.weaknesses.length > 0 && (
                <div className="review-row">
                  <span className="review-row-label">Mejoras</span>
                  <ul className="review-list review-list--negative">
                    {review.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function DetailPanel({ photo, allThemes }: DetailPanelProps) {
  const router = useRouter();
  const { track } = useAnalytics();
  const { tags, newTag, setNewTag, addTag, removeTag, mergeAiTags, errorToast, showErrorToast } = useTagEditor(photo);
  const {
    classifying, classifyError,
    reviewing, review, setReview,
    reviewError, setReviewError,
    classify, requestReview,
  } = useAiReview(photo.id);
  const [assignedThemeIds, setAssignedThemeIds] = useState<Set<number>>(
    new Set(photo.themes.map((t) => t.id))
  );
  const [isFavorite, setIsFavorite] = useState(photo.is_favorite === 1);

  async function handleClassify() {
    const aiTags = await classify();
    if (aiTags) mergeAiTags(aiTags);
  }

  async function toggleTheme(themeId: number) {
    const prevThemeIds = assignedThemeIds;
    const next = new Set(assignedThemeIds);
    if (next.has(themeId)) next.delete(themeId);
    else next.add(themeId);
    setAssignedThemeIds(next);
    try {
      const res = await fetch(`/api/photo-themes/${photo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeIds: Array.from(next) }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error('[DetailPanel] toggleTheme failed:', err instanceof Error ? err.message : err);
      setAssignedThemeIds(prevThemeIds);
    }
  }

  async function toggleFavorite() {
    const prev = isFavorite;
    const next = !isFavorite;
    setIsFavorite(next);
    track('photo_favorited', { photo_id: photo.id, action: next ? 'add' : 'remove' });
    try {
      const res = await fetch(`/api/photos/${photo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: next }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
    } catch (err) {
      console.error('[DetailPanel] toggleFavorite failed:', err instanceof Error ? err.message : err);
      setIsFavorite(prev);
      showErrorToast('No se pudo cambiar el favorito. Inténtalo de nuevo.');
    }
  }

  const takenDate = photo.taken_at
    ? new Date(photo.taken_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const sizeMb = photo.size_bytes ? (photo.size_bytes / 1024 / 1024).toFixed(1) : null;
  const dimensions = photo.width && photo.height ? `${photo.width}×${photo.height}` : null;

  return (
    <div className="detail-panel">
      {/* Metadata */}
      <div>
        <div className="panel-section-title">Información</div>
        {takenDate && (
          <div className="meta-row">
            <IconCalendar />
            <span className="meta-row-label">Fecha</span>
            <span className="meta-row-value">{takenDate}</span>
          </div>
        )}
        {photo.camera && (
          <div className="meta-row">
            <IconCamera />
            <span className="meta-row-label">Cámara</span>
            <span className="meta-row-value">{photo.camera}</span>
          </div>
        )}
        {photo.exposure && (
          <div className="meta-row">
            <IconAperture />
            <span className="meta-row-label">Exposición</span>
            <span className="meta-row-value">{photo.exposure}</span>
          </div>
        )}
        {photo.gps_lat && photo.gps_lon && (
          <div className="meta-row">
            <IconMap />
            <span className="meta-row-label">GPS</span>
            <span className="meta-row-value">{photo.gps_lat.toFixed(4)}, {photo.gps_lon.toFixed(4)}</span>
          </div>
        )}
        {(sizeMb || dimensions) && (
          <div className="meta-row">
            <IconFile />
            <span className="meta-row-label">Tamaño</span>
            <span className="meta-row-value">
              {[sizeMb && `${sizeMb} MB`, dimensions].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}
        <div className="meta-row" style={{ marginTop: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{photo.event}</span>
          <button
            onClick={toggleFavorite}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: isFavorite ? '#e8a020' : 'var(--text-tertiary)',
            }}
            title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          >
            <IconStar size={16} filled={isFavorite} />
          </button>
        </div>
      </div>

      {/* Tags */}
      <div>
        <div className="panel-section-title">Etiquetas</div>
        <div className="tags-area">
          {tags.map((tag) => (
            <div key={tag.name} className={`tag ${tag.source === 'ai' ? 'auto' : ''}`}>
              {tag.name}
              {tag.source === 'ai' && <span className="tag-ai-badge">IA</span>}
              <button className="tag-remove" onClick={() => removeTag(tag.name)} aria-label={`Eliminar etiqueta ${tag.name}`}>
                <IconX />
              </button>
            </div>
          ))}
        </div>
        <div className="tag-input-row">
          <input
            className="tag-input"
            placeholder="Añadir etiqueta…"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTag(); }}
          />
          <button className="btn-small" onClick={addTag} aria-label="Añadir etiqueta">Añadir</button>
        </div>
      </div>

      {/* AI classify */}
      <div>
        <Button
          variant="subtle"
          onClick={handleClassify}
          disabled={classifying}
          aria-label={classifying ? 'Clasificando foto con IA…' : 'Clasificar foto con IA'}
        >
          {classifying ? <><span className="spinner dark" />Clasificando…</> : <><IconSparkle size={13} />Clasificar con IA</>}
        </Button>
        {classifyError && (
          <div style={{
            marginTop: 6, padding: '6px 8px', borderRadius: 'var(--radius-sm)',
            background: '#fff3f3', border: '1px solid #fca5a5',
            fontSize: 12, color: 'var(--danger)', lineHeight: 1.4,
          }}>
            {classifyError}
          </div>
        )}
      </div>

      {/* AI review */}
      <div>
        <Button
          variant="subtle"
          onClick={requestReview}
          disabled={reviewing}
          aria-label={reviewing ? 'Analizando imagen…' : 'Evaluar imagen con IA'}
        >
          {reviewing ? <><span className="spinner dark" />Analizando…</> : <><IconEye size={13} />Evaluar imagen</>}
        </Button>
      </div>

      <ReviewModal
        review={review}
        error={reviewError}
        onClose={() => { setReview(null); setReviewError(null); }}
      />

      {/* Themes */}
      {allThemes.length > 0 && (
        <div>
          <div className="panel-section-title">Temáticas</div>
          <div className="theme-list">
            {allThemes.map((theme) => {
              const assigned = assignedThemeIds.has(theme.id);
              return (
                <button
                  key={theme.id}
                  className={`theme-item ${assigned ? 'assigned' : ''}`}
                  onClick={() => toggleTheme(theme.id)}
                  aria-pressed={assigned}
                  aria-label={`${assigned ? 'Quitar temática' : 'Asignar temática'} "${theme.name}"`}
                >
                  <span className="theme-dot" style={{ background: theme.color }} />
                  <span className="theme-item-name">{theme.name}</span>
                  <span className="theme-check"><IconCheck /></span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Inline error toast for optimistic update failures */}
      {errorToast && (
        <div style={{
          position: 'sticky', bottom: 8, margin: '8px 8px 0',
          padding: '8px 12px', borderRadius: 'var(--radius-sm)',
          background: '#fff3f3', border: '1px solid #fca5a5',
          fontSize: 12, color: 'var(--danger)', lineHeight: 1.4,
          animation: 'toastIn 0.2s ease',
        }}>
          {errorToast}
        </div>
      )}
    </div>
  );
}
