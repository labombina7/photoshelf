'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconChevronLeft, IconTrash, IconEdit, IconX, IconCheck } from '@/components/Icons';

interface ProjectPhoto {
  id: number;
  filename: string;
  year: number;
  event: string;
  taken_at: string | null;
  position: number;
}

interface Project {
  id: number;
  title: string;
  statement: string;
  scope_type: string;
  scope_value: string | null;
  created_at: string;
  photos: ProjectPhoto[];
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingStatement, setEditingStatement] = useState(false);
  const [editStatement, setEditStatement] = useState('');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}`).then(r => r.json()).then(setProject);
  }, [id]);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (lightboxIdx === null || !project) return;
    if (e.key === 'ArrowRight') setLightboxIdx(i => Math.min((i ?? 0) + 1, project.photos.length - 1));
    if (e.key === 'ArrowLeft') setLightboxIdx(i => Math.max((i ?? 0) - 1, 0));
    if (e.key === 'Escape') setLightboxIdx(null);
  }, [lightboxIdx, project]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  async function saveTitle() {
    if (!project || !editTitle.trim()) return;
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle.trim() }),
    });
    setProject(p => p ? { ...p, title: editTitle.trim() } : p);
    setEditingTitle(false);
  }

  async function saveStatement() {
    if (!project) return;
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statement: editStatement }),
    });
    setProject(p => p ? { ...p, statement: editStatement } : p);
    setEditingStatement(false);
  }

  async function removePhoto(photoId: number) {
    if (!project) return;
    const newPhotos = project.photos.filter(p => p.id !== photoId);
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds: newPhotos.map(p => p.id) }),
    });
    setProject(p => p ? { ...p, photos: newPhotos } : p);
  }

  async function deleteProject() {
    if (!confirm('¿Eliminar este proyecto?')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    router.push('/projects');
  }

  if (!project) return <div style={{ padding: 48, color: 'var(--text-tertiary)' }}>Cargando…</div>;

  const currentPhoto = lightboxIdx !== null ? project.photos[lightboxIdx] : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div className="project-detail-header">
        <Link href="/projects" className="btn-back" style={{ display: 'inline-flex' }}>
          <IconChevronLeft size={14} />
          Proyectos
        </Link>
        <button className="btn-icon" onClick={deleteProject} title="Eliminar proyecto" style={{ marginLeft: 'auto' }}>
          <IconTrash size={14} />
        </button>
      </div>

      {/* Hero */}
      <div className="project-hero">
        {project.photos[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="project-hero-img"
            src={`/api/photos/${project.photos[0].id}/thumbnail?size=1920&fit=inside`}
            alt={project.title}
            onClick={() => setLightboxIdx(0)}
          />
        )}
        <div className="project-hero-overlay">
          <div className="project-hero-content">
            {editingTitle ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="project-title-input"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                  autoFocus
                />
                <button onClick={saveTitle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}><IconCheck size={16} /></button>
                <button onClick={() => setEditingTitle(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}><IconX size={16} /></button>
              </div>
            ) : (
              <h1 className="project-title" onClick={() => { setEditTitle(project.title); setEditingTitle(true); }}>
                {project.title}
                <span style={{ opacity: 0.5, display: 'inline-flex' }}><IconEdit size={14} /></span>
              </h1>
            )}
            {editingStatement ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  className="project-statement-input"
                  value={editStatement}
                  onChange={e => setEditStatement(e.target.value)}
                  rows={3}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-small" onClick={saveStatement}>Guardar</button>
                  <button className="btn-small" style={{ background: 'rgba(255,255,255,0.2)' }} onClick={() => setEditingStatement(false)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <p className="project-statement" onClick={() => { setEditStatement(project.statement); setEditingStatement(true); }}>
                {project.statement || <span style={{ opacity: 0.4 }}>Añadir statement…</span>}
              </p>
            )}
            <p className="project-meta">{project.photos.length} fotografías · {new Date(project.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })}</p>
          </div>
        </div>
      </div>

      {/* Photo sequence */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 32px' }}>
        <div className="project-sequence">
          {project.photos.map((photo, idx) => (
            <div key={photo.id} className="project-seq-item" onClick={() => setLightboxIdx(idx)}>
              <div className="project-seq-num">{String(idx + 1).padStart(2, '0')}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photos/${photo.id}/thumbnail?size=800&fit=inside`}
                alt={photo.filename}
                className="project-seq-img"
              />
              <button
                className="project-seq-remove"
                onClick={e => { e.stopPropagation(); removePhoto(photo.id); }}
                title="Quitar del proyecto"
              >
                <IconX size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {currentPhoto && (
        <div className="lightbox" onClick={() => setLightboxIdx(null)}>
          <button className="lightbox-close" onClick={() => setLightboxIdx(null)}><IconX size={18} /></button>
          <button
            className="lightbox-nav lightbox-nav--prev"
            onClick={e => { e.stopPropagation(); setLightboxIdx(i => Math.max((i ?? 1) - 1, 0)); }}
            disabled={lightboxIdx === 0}
          >‹</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/photos/${currentPhoto.id}/thumbnail?size=1920&fit=inside`}
            alt={currentPhoto.filename}
            className="lightbox-img"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="lightbox-nav lightbox-nav--next"
            onClick={e => { e.stopPropagation(); setLightboxIdx(i => Math.min((i ?? 0) + 1, project.photos.length - 1)); }}
            disabled={lightboxIdx === project.photos.length - 1}
          >›</button>
          <div className="lightbox-counter">{(lightboxIdx ?? 0) + 1} / {project.photos.length}</div>
        </div>
      )}
    </div>
  );
}
