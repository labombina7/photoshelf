'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconX, IconSparkle, IconCheck, IconCalendar,
  IconCamera, IconMap, IconFile, IconAperture,
} from './Icons';
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
  const [isFavorite, setIsFavorite] = useState(photo.is_favorite === 1);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<PhotoReview | null>(null);

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
    await fetch(`/api/tags/${photo.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setTags((prev) => prev.filter((t) => t.name !== name));
  }

  async function classify() {
    setClassifying(true);
    try {
      const res = await fetch(`/api/ai/classify/${photo.id}`, { method: 'POST' });
      const data = await res.json();
      if (data.tags) {
        // Merge AI tags without overwriting manual ones
        setTags((prev) => {
          const existing = new Set(prev.map((t) => t.name));
          const newAi = data.tags
            .filter((n: string) => !existing.has(n))
            .map((n: string, i: number) => ({ id: -(i + 1), name: n, source: 'ai' as const }));
          return [...prev, ...newAi];
        });
      }
    } catch {
      // silently fail
    } finally {
      setClassifying(false);
    }
  }

  async function requestReview() {
    setReviewing(true);
    setReview(null);
    try {
      const res = await fetch(`/api/ai/review/${photo.id}`, { method: 'POST' });
      const data: PhotoReview = await res.json();
      setReview(data);
    } catch {
      // silently fail
    } finally {
      setReviewing(false);
    }
  }

  async function toggleTheme(themeId: number) {
    const next = new Set(assignedThemeIds);
    if (next.has(themeId)) next.delete(themeId);
    else next.add(themeId);
    setAssignedThemeIds(next);
    await fetch(`/api/photo-themes/${photo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeIds: Array.from(next) }),
    });
    router.refresh();
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
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
              <button className="tag-remove" onClick={() => removeTag(tag.name)}>
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
          <button className="btn-small" onClick={addTag}>+</button>
        </div>
      </div>

      {/* AI classify */}
      <div>
        <button className="ai-classify-btn" onClick={classify} disabled={classifying}>
          {classifying ? (
            <>
              <span className="spinner dark" />
              Clasificando…
            </>
          ) : (
            <>
              <IconSparkle />
              Clasificar con IA (Ollama)
            </>
          )}
        </button>
      </div>

      {/* AI review */}
      <div>
        <button className="ai-classify-btn" onClick={requestReview} disabled={reviewing}>
          {reviewing ? (
            <>
              <span className="spinner dark" />
              Analizando…
            </>
          ) : (
            <>
              <IconSparkle />
              Revisar con IA
            </>
          )}
        </button>

        {review && (
          <div className="review-block">
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
        )}
      </div>

      {/* Themes */}
      {allThemes.length > 0 && (
        <div>
          <div className="panel-section-title">Temáticas</div>
          <div className="theme-list">
            {allThemes.map((theme) => (
              <div
                key={theme.id}
                className={`theme-item ${assignedThemeIds.has(theme.id) ? 'assigned' : ''}`}
                onClick={() => toggleTheme(theme.id)}
              >
                <span className="theme-dot" style={{ background: theme.color }} />
                <span className="theme-item-name">{theme.name}</span>
                <span className="theme-check"><IconCheck /></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
