'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useHeaderSlot } from '@/components/HeaderSlot';
import { IconMenu } from '@/components/Icons';
import type { ThemeWithCount } from '@/lib/queries/themes';
import type { CatalogRow } from '@/lib/queries/catalogs';

interface Props {
  themes: ThemeWithCount[];
  projects: { id: number; title: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs?: CatalogRow[];
  activeCatalogId?: number;
}

const LINKS = [
  {
    href: '/about/docs',
    label: 'Documentación',
    description: 'Especificaciones de todas las historias de usuario — pendientes y completadas.',
    icon: '📄',
  },
  {
    href: '/tools/roadmap',
    label: 'Roadmap',
    description: 'Kanban visual con el estado de todas las historias de usuario.',
    icon: '🗺',
  },
  {
    href: '/specs/kanban.html',
    label: 'Kanban (pantalla completa)',
    description: 'Abre el kanban en modo standalone, sin el layout de la app.',
    icon: '⛶',
    external: true,
  },
];

const STACK = [
  { label: 'Next.js 15', detail: 'App Router + React 19' },
  { label: 'SQLite', detail: 'better-sqlite3, acceso síncrono' },
  { label: 'Ollama', detail: 'IA local — LLaVA para clasificación y búsqueda' },
  { label: 'TypeScript', detail: 'strict: true' },
  { label: 'Docker', detail: 'imagen en ghcr.io, datos en bind mount' },
];

export default function AboutClient({
  themes, projects, totalPhotos, favoriteCount, untaggedCount, catalogs, activeCatalogId,
}: Props) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useHeaderSlot(useMemo(() => (
    <div className="header-slot-library">
      <button className="hamburger header-slot-hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
        <IconMenu size={20} />
      </button>
      <span className="header-slot-title">Acerca de</span>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), []));

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
        catalogs={catalogs}
        activeCatalogId={activeCatalogId}
      />

      <div className="main">
        <div className="content" style={{ maxWidth: 640 }}>

          {/* Hero */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <span style={{ fontSize: 36 }}>📷</span>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>photoshelf</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
                  Biblioteca de fotos personal — local, sin lock-in, con IA opcional.
                </p>
              </div>
            </div>
          </div>

          {/* Documentación */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
              Documentación
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {LINKS.map(link => (
                link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', textDecoration: 'none', color: 'inherit',
                      transition: 'border-color 0.12s, box-shadow 0.12s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(59,98,212,0.08)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{link.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{link.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{link.description}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>↗</span>
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', textDecoration: 'none', color: 'inherit',
                      transition: 'border-color 0.12s, box-shadow 0.12s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(59,98,212,0.08)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{link.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{link.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{link.description}</div>
                    </div>
                  </Link>
                )
              ))}
            </div>
          </section>

          {/* Stack técnico */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
              Stack
            </h2>
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', overflow: 'hidden',
            }}>
              {STACK.map((item, i) => (
                <div key={item.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '11px 16px',
                  borderTop: i > 0 ? '1px solid var(--border-light)' : 'none',
                }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.detail}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            Proyecto personal · Código en{' '}
            <a href="https://github.com/labombina7/photoshelf" target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              GitHub
            </a>
          </p>

        </div>
      </div>
    </div>
  );
}
