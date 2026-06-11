'use client';

import { useState } from 'react';
import { IconShare } from '@/components/Icons';
import ShareDialog from '@/components/ShareDialog';

interface ShareButtonProps {
  photoIds?: number[];
  albumId?: number;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function ShareButton({ photoIds, albumId, label, className, children }: ShareButtonProps) {
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<{ url: string; photoCount: number } | null>(null);

  async function handleShare() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds, albumId, label }),
      });
      const data = await res.json() as { url?: string; photoCount?: number; error?: string };
      if (!res.ok || !data.url) {
        alert(data.error ?? 'Error al generar el enlace');
        return;
      }
      const { url, photoCount = 0 } = data;

      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: 'Fotos compartidas',
            text: `${photoCount} ${photoCount === 1 ? 'foto' : 'fotos'}`,
            url,
          });
        } catch (err) {
          // User cancelled or share not supported — fall through to dialog
          if ((err as { name?: string }).name !== 'AbortError') {
            setDialog({ url, photoCount });
          }
        }
      } else {
        setDialog({ url, photoCount });
      }
    } catch (err) {
      console.error('[ShareButton]', err);
      alert('Error al generar el enlace');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className={className ?? 'collapse-btn'}
        onClick={handleShare}
        disabled={loading}
        title="Compartir enlace de descarga"
      >
        {loading ? (
          <>Generando enlace…</>
        ) : (
          <>
            <IconShare size={12} />
            {children ?? 'Compartir enlace'}
          </>
        )}
      </button>

      {dialog && (
        <ShareDialog
          url={dialog.url}
          photoCount={dialog.photoCount}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
