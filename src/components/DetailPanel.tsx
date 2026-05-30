'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

export default function DetailPanel({ photo, allThemes }: DetailPanelProps) {
  const router = useRouter();
  const [tags, setTags] = useState(photo.tags);
  const [assignedThemeIds, setAssignedThemeIds] = useState<Set<number>>(
    new Set(photo.themes.map((t) => t.id))
  );
  const [newTag, setNewTag] = useState('');
  const [classifying, setClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(photo.is_favorite === 1);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<PhotoReview | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const errorToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showErrorToast(msg: string) {
    if (errorToastTimer.current) clearTimeout(errorToastTimer.current);
    setErrorToast(msg);
    errorToastTimer.current = setTimeout(() => setErrorToast(null), 4000);
  }

  useEffect(() => () => { if (errorToastTimer.current) clearTimeout(errorToastTimer.current); }, []);

  async function addTag() {
    const name = newTag.trim().toLowerCase();
    if (!name) return;
    const res = await fetch(`/api/tags/${photo.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, source: 'manual' }),
    });
    if (res.ok) {
      const data = await res.json();
      setTags((prev) => [...prev.filter((t) => t.name !== data.name), { id: data.id, name: data.name, source: 'manual' }]);
      setNewTag('');
    }
  }

  async function removeTag(name: string) {
    const prevTags = tags;
    setTags((prev) => prev.filter((t) => t.name !== name)); // optimistic
    try {
      const res = await fetch(`/api/tags/${photo.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
    } catch (err) {
      console.error('[DetailPanel] removeTag failed:', err instanceof Error ? err.message : err);
      setTags(prevTags); // rollback
      showErrorToast('No se pudo eliminar la etiqueta. Inténtalo de nuevo.');
    }
  }

  async function classify() {
    setClassifying(true);
    setClassifyError(null);
    try {
      const res = await fetch(`/api/ai/classify/${photo.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);
      if (data.tags?.length === 0) {
        setClassifyError('La IA no generó ningún tag. Comprueba que Ollama esté disponible.');
      } else if (data.tags) {
        // Merge AI tags without overwriting manual ones
        setTags((prev) => {
          const existing = new Set(prev.map((t) => t.name));
          const newAi = data.tags
            .filter((n: string) => !existing.has(n))
            .map((n: string, i: number) => ({ id: -(i + 1), name: n, source: 'ai' as const }));
          return [...prev, ...newAi];
        });
      }
    } catch (err) {
      setClassifyError(err instanceof Error ? err.message : 'Error al clasificar la imagen');
    } finally {
      setClassifying(false);
    }
  }

  async function requestReview() {
    setReviewing(true);
    setReview(null);
    setReviewError(null);
    try {
      const res = await fetch(`/api/ai/review/${photo.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);
      const r = data as PhotoReview;
      const isEmpty = !r.score && !r.summary && !r.composition && !r.light
        && r.strengths.length === 0 && r.weaknesses.length === 0;
      if (isEmpty) {
        throw new Error('La IA no pudo generar un análisis. Comprueba que Ollama esté disponible e inténtalo de nuevo.');
      }
      setReview(r);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Error al analizar la imagen');
    } finally {
      setReviewing(false);
    }
  }

  async function toggleTheme(themeId: number) {
    const prevThemeIds = assignedThemeIds;
    const next = new Set(assignedThemeIds);
    if (next.has(themeId)) next.delete(themeId);
    else next.add(themeId);
    setAssignedThemeIds(next); // optimistic
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
      setAssignedThemeIds(prevThemeIds); // rollback
      showErrorToast('No se pudo actualizar la temática. Inténtalo de nuevo.');
    }
  }

  async function toggleFavorite() {
    const next = !isFavorite;
    setIsFavorite(next);
    await fetch(`/api/photos/${photo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: next }),
    });
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
          onClick={classify}
          disabled={classifying}
          aria-label={classifying ? 'Clasificando foto con IA…' : 'Clasificar foto con IA'}
        >
          {classifying ? <><span className="spinner dark" />Clasificando…</> : <><IconSparkle size={13} />Clasificar con IA</>}
        </Button>
        {classifyError && (
          <div style={{
            marginTop: 6, padding: '6px 8px', borderRadius: 'var(--radius-sm)',
            background: '#fff3f3', border: '1px solid #fca5a5',
            fontSize: 12, color: '#b91c1c', lineHeight: 1.4,
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

      {/* Review error */}
      {reviewError && (
        <>
          <div className="review-overlay" onClick={() => setReviewError(null)} />
          <div className="review-modal">
            <div className="review-modal-header">
              <span style={{ fontWeight: 600, fontSize: 14 }}>Análisis de la imagen</span>
              <button className="ai-panel-close" onClick={() => setReviewError(null)} aria-label="Cerrar análisis de IA">
                <IconX size={14} />
              </button>
            </div>
            <div className="review-modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                No se pudo analizar la imagen: <strong>{reviewError}</strong>
              </p>
            </div>
          </div>
        </>
      )}

      {/* Review modal */}
      {review && (
        <>
          <div className="review-overlay" onClick={() => setReview(null)} />
          <div className="review-modal">
            <div className="review-modal-header">
              <span style={{ fontWeight: 600, fontSize: 14 }}>Análisis de la imagen</span>
              <button className="ai-panel-close" onClick={() => setReview(null)} aria-label="Cerrar análisis de IA">
                <IconX size={14} />
              </button>
            </div>
            <div className="review-modal-body">
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
            </div>
          </div>
        </>
      )}

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
          fontSize: 12, color: '#b91c1c', lineHeight: 1.4,
          animation: 'toastIn 0.2s ease',
        }}>
          {errorToast}
        </div>
      )}
    </div>
  );
}
