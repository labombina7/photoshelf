'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useModal } from '@/components/ModalProvider';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { IconChevronLeft, IconTrash, IconX, IconCheck, IconEdit, IconMenu } from '@/components/Icons';
import { useHeaderSlot } from '@/components/HeaderSlot';
import type { Theme } from '@/lib/types';

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

interface Props {
  project: Project;
  themes: Theme[];
  projects: { id: number; title: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
}

export default function ProjectDetailClient({ project: initial, themes, projects, totalPhotos, favoriteCount, untaggedCount }: Props) {
  const router = useRouter();
  const { confirm } = useModal();
  const [project, setProject] = useState(initial);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingStatement, setEditingStatement] = useState(false);
  const [editStatement, setEditStatement] = useState('');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (lightboxIdx === null) return;
    if (e.key === 'ArrowRight') setLightboxIdx(i => Math.min((i ?? 0) + 1, project.photos.length - 1));
    if (e.key === 'ArrowLeft') setLightboxIdx(i => Math.max((i ?? 0) - 1, 0));
    if (e.key === 'Escape') setLightboxIdx(null);
  }, [lightboxIdx, project.photos.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  async function saveTitle() {
    if (!editTitle.trim()) return;
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle.trim() }),
    });
    setProject(p => ({ ...p, title: editTitle.trim() }));
    setEditingTitle(false);
  }

  async function saveStatement() {
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statement: editStatement }),
    });
    setProject(p => ({ ...p, statement: editStatement }));
    setEditingStatement(false);
  }

  async function removePhoto(photoId: number) {
    const newPhotos = project.photos.filter(p => p.id !== photoId);
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds: newPhotos.map(p => p.id) }),
    });
    setProject(p => ({ ...p, photos: newPhotos }));
  }

  const deleteProject = useCallback(async () => {
    const ok = await confirm('¿Eliminar este proyecto?', { title: 'Eliminar proyecto', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
    router.push('/projects');
  }, [project.id, confirm, router]);

  useHeaderSlot(useMemo(() => (
    <div className="header-slot-library">
      <button className="hamburger header-slot-hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
        <IconMenu size={20} />
      </button>
      <Link href="/projects" className="back-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <IconChevronLeft size={14} />
        Proyectos
      </Link>
      <span style={{ color: 'var(--text-tertiary)' }}>/</span>
      <span className="header-slot-title">{project.title}</span>
      <div className="topbar-spacer" />
      <button className="btn-icon" onClick={deleteProject} title="Eliminar proyecto">
        <IconTrash size={14} />
      </button>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [project.title, deleteProject]));

  const currentPhoto = lightboxIdx !== null ? project.photos[lightboxIdx] : null;

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes}
        projects={projects}
        totalPhotos={totalPhotos}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <div className="main">
        <div className="content" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Hero */}
          <div className="project-hero">
            {project.photos[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="project-hero-img"
                src={`/api/photos/${project.photos[0].id}/thumbnail?size=1920&fit=inside`}
                alt={project.title}
                decoding="async"
                onClick={() => setLightboxIdx(0)}
              />
            )}
            <div className="project-hero-overlay">
              <div className="project-hero-content">
                {editingTitle ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                    <input
                      className="project-title-input"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                      autoFocus
                    />
                    <button onClick={saveTitle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}><IconCheck size={16} /></button>
                    <button onClick={() => setEditingTitle(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}><IconX size={16} /></button>
                  </div>
                ) : (
                  <h1 className="project-title" onClick={() => { setEditTitle(project.title); setEditingTitle(true); }}>
                    {project.title}
                    <span style={{ opacity: 0.4, display: 'inline-flex', marginLeft: 8 }}><IconEdit size={14} /></span>
                  </h1>
                )}

                {editingStatement ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    <textarea
                      className="project-statement-input"
                      value={editStatement}
                      onChange={e => setEditStatement(e.target.value)}
                      rows={3}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-small" onClick={saveStatement}>Guardar</button>
                      <button className="btn-small" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }} onClick={() => setEditingStatement(false)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <p className="project-statement" onClick={() => { setEditStatement(project.statement); setEditingStatement(true); }}>
                    {project.statement || <span style={{ opacity: 0.4 }}>Añadir statement…</span>}
                  </p>
                )}

                <p className="project-meta">
                  {project.photos.length} fotografías · {new Date(project.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>
          </div>

          {/* Photo sequence */}
          <div style={{ padding: '32px 28px', overflowY: 'auto', flex: 1 }}>
            <div className="project-sequence">
              {project.photos.map((photo, idx) => (
                <div key={photo.id} className="project-seq-item" onClick={() => setLightboxIdx(idx)}>
                  <div className="project-seq-num">{String(idx + 1).padStart(2, '0')}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/photos/${photo.id}/thumbnail?size=600&fit=inside`}
                    alt={photo.filename}
                    className="project-seq-img"
                    loading="lazy"
                    decoding="async"
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
            decoding="async"
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
