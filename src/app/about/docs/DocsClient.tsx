'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useHeaderSlot } from '@/components/HeaderSlot';
import { IconMenu } from '@/components/Icons';
import type { SpecMeta } from '@/lib/specs';
import type { ThemeWithCount } from '@/lib/queries/themes';
import type { CatalogRow } from '@/lib/queries/catalogs';

interface Props {
  specs: { todo: SpecMeta[]; done: SpecMeta[] };
  themes: ThemeWithCount[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs?: CatalogRow[];
  activeCatalogId?: number;
}

const EFFORT_STYLE: Record<string, React.CSSProperties> = {
  S: { color: '#16a34a', borderColor: '#16a34a' },
  M: { color: '#b45309', borderColor: '#b45309' },
  L: { color: '#c2410c', borderColor: '#c2410c' },
};

function SpecRow({ spec }: { spec: SpecMeta }) {
  const isEpic = spec.id.startsWith('EPIC');
  return (
    <Link
      href={`/about/docs/${spec.slug}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
        textDecoration: 'none', color: 'inherit',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      <span style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.05em',
        padding: '2px 6px', borderRadius: 4, flexShrink: 0,
        background: isEpic ? '#ede9fe' : 'var(--tag-bg)',
        color: isEpic ? '#6d28d9' : 'var(--text-secondary)',
      }}>
        {spec.id}
      </span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{spec.title}</span>
      {spec.effort && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 5px',
          border: '1px solid', borderRadius: 4, flexShrink: 0,
          ...EFFORT_STYLE[spec.effort],
        }}>
          {spec.effort}
        </span>
      )}
      {spec.status === 'done' && (
        <span style={{ fontSize: 11, color: '#16a34a', flexShrink: 0 }}>✓</span>
      )}
    </Link>
  );
}

export default function DocsClient({
  specs, themes, totalPhotos, favoriteCount, untaggedCount, catalogs, activeCatalogId,
}: Props) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [tab, setTab] = useState<'todo' | 'done'>('todo');
  const [query, setQuery] = useState('');

  useHeaderSlot(useMemo(() => (
    <div className="header-slot-library">
      <button className="hamburger header-slot-hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
        <IconMenu size={20} />
      </button>
      <span className="header-slot-title">Documentación</span>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), []));

  const filtered = specs[tab].filter(s =>
    !query || s.title.toLowerCase().includes(query.toLowerCase()) || s.id.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes} totalPhotos={totalPhotos}
        favoriteCount={favoriteCount} untaggedCount={untaggedCount}
        mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)}
        catalogs={catalogs} activeCatalogId={activeCatalogId}
      />

      <div className="main">
        <div className="content" style={{ maxWidth: 720 }}>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Link href="/about" style={{ color: 'var(--text-tertiary)', fontSize: 12, textDecoration: 'none' }}>
                Acerca de
              </Link>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>/</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Documentación</span>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Especificaciones</h1>
          </div>

          {/* Tabs + búsqueda */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['todo', 'done'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '5px 14px', borderRadius: 6, border: '1px solid',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  background: tab === t ? 'var(--accent)' : 'transparent',
                  color: tab === t ? '#fff' : 'var(--text-secondary)',
                  borderColor: tab === t ? 'var(--accent)' : 'var(--border)',
                  transition: 'all 0.12s',
                }}>
                  {t === 'todo' ? `Pendiente (${specs.todo.length})` : `Completado (${specs.done.length})`}
                </button>
              ))}
            </div>
            <input
              type="search"
              placeholder="Filtrar…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                marginLeft: 'auto', padding: '5px 10px', border: '1px solid var(--border)',
                borderRadius: 6, fontSize: 12, background: 'var(--bg)', color: 'var(--text)',
                fontFamily: 'inherit', outline: 'none', width: 160,
              }}
            />
          </div>

          {/* Lista */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', overflow: 'hidden',
          }}>
            {filtered.length === 0 ? (
              <p style={{ padding: '24px 16px', color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center' }}>
                Sin resultados
              </p>
            ) : filtered.map((spec, i) => (
              <div key={spec.slug} style={{ borderTop: i > 0 ? '1px solid var(--border-light)' : 'none' }}>
                <SpecRow spec={spec} />
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
