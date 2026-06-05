'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  catalogId: number;
  catalogName: string;
  alreadyOrganized: boolean;
}

export default function UnstructuredCatalogBanner({ catalogId, catalogName, alreadyOrganized }: Props) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: '3px solid var(--text)',
      borderRadius: 'var(--radius)',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
          {alreadyOrganized
            ? `"${catalogName}" está organizado con smart albums automáticos`
            : `"${catalogName}" no tiene estructura de eventos`}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
          {alreadyOrganized
            ? 'Puedes actualizar la organización o deshacerla desde la página de organización.'
            : 'Photoshelf puede organizar las fotos en smart albums automáticamente usando las fechas EXIF.'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {!alreadyOrganized && (
          <button
            className="btn-small"
            style={{ background: 'var(--border)', color: 'var(--text)' }}
            onClick={() => setDismissed(true)}
          >
            Ignorar
          </button>
        )}
        <button
          className="btn-small"
          onClick={() => router.push(`/catalogs/${catalogId}/organize`)}
        >
          {alreadyOrganized ? 'Gestionar organización' : 'Organizar con smart albums'}
        </button>
      </div>
    </div>
  );
}
