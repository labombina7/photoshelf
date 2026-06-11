'use client';

import { useState } from 'react';
import { IconShare } from '@/components/Icons';
import ShareDialog from '@/components/ShareDialog';
import { sharePhotos } from '@/lib/shareUtils';

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
      const ids = photoIds ?? [];
      const result = await sharePhotos(ids, label, albumId);
      if (result) setDialog(result);
    } catch (err) {
      console.error('[ShareButton]', err);
      alert('Error al compartir');
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
        title="Compartir fotos"
      >
        {loading ? (
          <>Preparando…</>
        ) : (
          <>
            <IconShare size={12} />
            {children ?? 'Compartir'}
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
