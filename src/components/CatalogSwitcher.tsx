'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CatalogRow } from '@/lib/queries/catalogs';

interface CatalogSwitcherProps {
  catalogs: CatalogRow[];
  activeCatalogId: number;
}

export default function CatalogSwitcher({ catalogs, activeCatalogId }: CatalogSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const active = catalogs.find(c => c.id === activeCatalogId) ?? catalogs[0];

  async function switchCatalog(id: number) {
    if (id === activeCatalogId) { setOpen(false); return; }
    setOpen(false);
    await fetch('/api/catalogs/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalogId: id }),
    });
    startTransition(() => {
      router.push('/library');
      router.refresh();
    });
  }

  // Single catalog: show name as a static link to the settings page
  if (catalogs.length <= 1) {
    return (
      <a
        href="/settings/catalogs"
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 10px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 12, color: 'var(--text-secondary)',
          textDecoration: 'none',
        }}
        title="Gestionar catálogos"
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: 'var(--accent)' }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {active?.name ?? 'Principal'}
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>+</span>
      </a>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={isPending}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '6px 10px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          background: 'transparent',
          fontFamily: 'inherit',
          fontSize: 12,
          color: 'var(--text-secondary)',
          cursor: isPending ? 'not-allowed' : 'pointer',
          textAlign: 'left',
        }}
        title="Cambiar catálogo activo"
      >
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: 'var(--accent)',
        }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {active?.name ?? '—'}
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: 0, right: 0,
            background: 'var(--sidebar-bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            zIndex: 100,
            overflow: 'hidden',
          }}>
            {catalogs.map(cat => (
              <button
                key={cat.id}
                onClick={() => switchCatalog(cat.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  border: 'none',
                  background: cat.id === activeCatalogId ? 'var(--sidebar-hover)' : 'transparent',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  color: cat.id === activeCatalogId ? 'var(--text)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {cat.id === activeCatalogId && (
                  <span style={{ color: 'var(--accent)', fontSize: 10 }}>✓</span>
                )}
                {cat.id !== activeCatalogId && <span style={{ width: 10 }} />}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cat.name}
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                  {cat.photo_count.toLocaleString('es')}
                </span>
              </button>
            ))}
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <a
                href="/settings/catalogs"
                onClick={() => setOpen(false)}
                style={{
                  display: 'block',
                  padding: '7px 12px',
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  textDecoration: 'none',
                }}
              >
                Gestionar catálogos…
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
