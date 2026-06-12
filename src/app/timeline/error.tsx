'use client';

import { useEffect } from 'react';

export default function TimelineError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Timeline] Error boundary caught:', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 24, gap: 16, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        maxWidth: 480, width: '100%', background: '#fff3f3',
        border: '1px solid #fca5a5', borderRadius: 8, padding: 20,
      }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--danger)' }}>
          Error al cargar la línea de tiempo
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#7f1d1d', wordBreak: 'break-all' }}>
          {error.message || 'Error desconocido'}
        </p>
        {error.digest && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--danger)', opacity: 0.7 }}>
            Digest: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        style={{
          padding: '8px 20px', borderRadius: 6, border: 'none',
          background: 'var(--danger)', color: '#fff', fontSize: 13, cursor: 'pointer',
        }}
      >
        Reintentar
      </button>
    </div>
  );
}
