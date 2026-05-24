'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CatalogRow } from '@/lib/queries/catalogs';

interface CatalogSwitcherProps {
  catalogs: CatalogRow[];
  activeCatalogId: number;
}

export default function CatalogSwitcher({ catalogs, activeCatalogId }: CatalogSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function switchCatalog(id: number) {
    if (id === activeCatalogId) return;
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

  // Single catalog — just show name + link to settings
  if (catalogs.length <= 1) {
    const active = catalogs[0];
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
        <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>+</span>
      </a>
    );
  }

  // Multiple catalogs — native <select> (no positioning headaches)
  return (
    <select
      value={activeCatalogId}
      disabled={isPending}
      onChange={e => switchCatalog(Number(e.target.value))}
      style={{
        width: '100%',
        padding: '6px 10px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--sidebar-bg)',
        fontFamily: 'inherit',
        fontSize: 12,
        color: 'var(--text-secondary)',
        cursor: isPending ? 'not-allowed' : 'pointer',
        appearance: 'auto',
      }}
      title="Cambiar catálogo activo"
    >
      {catalogs.map(cat => (
        <option key={cat.id} value={cat.id}>
          {cat.name} ({cat.photo_count.toLocaleString('es')})
        </option>
      ))}
    </select>
  );
}
