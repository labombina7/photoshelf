'use client';

import { useState } from 'react';
import { IconLink, IconX } from '@/components/Icons';

interface ShareDialogProps {
  url: string;
  photoCount: number;
  onClose: () => void;
}

export default function ShareDialog({ url, photoCount, onClose }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input
      const input = document.getElementById('share-url-input') as HTMLInputElement | null;
      input?.select();
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">
            <IconLink size={16} />
            Compartir enlace
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <IconX size={14} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: '1rem 1.25rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Enlace de descarga para {photoCount} {photoCount === 1 ? 'foto' : 'fotos'}.
            Válido 72 horas · ventana de descarga de 1 hora tras el primer uso.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="share-url-input"
              type="text"
              readOnly
              value={url}
              style={{
                flex: 1,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0.4rem 0.6rem',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
              }}
              onClick={e => (e.target as HTMLInputElement).select()}
            />
            <button className="btn-primary" onClick={handleCopy} style={{ flexShrink: 0 }}>
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
