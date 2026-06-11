'use client';

import { useState } from 'react';
import { IconShare } from '@/components/Icons';
import ShareDialog from '@/components/ShareDialog';

// ≤ this many photos → try direct file share (compressed thumbnails)
const DIRECT_SHARE_LIMIT = 10;
// Thumbnail size for direct sharing (similar to WhatsApp quality)
const SHARE_THUMB_SIZE = 1920;

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
      const canShareFiles =
        typeof navigator !== 'undefined' &&
        !!navigator.share &&
        !!navigator.canShare &&
        ids.length > 0 &&
        ids.length <= DIRECT_SHARE_LIMIT;

      if (canShareFiles) {
        // Try direct file share with compressed thumbnails
        const files = await fetchAsFiles(ids);
        if (files && navigator.canShare({ files })) {
          try {
            await navigator.share({
              files,
              title: label ?? 'Fotos',
              text: `${files.length} ${files.length === 1 ? 'foto' : 'fotos'}`,
            });
            return; // done — no link needed
          } catch (err) {
            if ((err as { name?: string }).name === 'AbortError') return;
            // Share failed — fall through to link
          }
        }
      }

      // Fallback: generate share link
      await shareViaLink(ids, albumId, label, setDialog);
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

async function fetchAsFiles(ids: number[]): Promise<File[] | null> {
  try {
    const files = await Promise.all(
      ids.map(async id => {
        const res = await fetch(`/api/photos/${id}/thumbnail?size=${SHARE_THUMB_SIZE}`);
        if (!res.ok) return null;
        const blob = await res.blob();
        const ext = blob.type === 'image/png' ? 'png' : 'jpg';
        return new File([blob], `foto_${id}.${ext}`, { type: blob.type });
      }),
    );
    const valid = files.filter((f): f is File => f !== null);
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

async function shareViaLink(
  ids: number[],
  albumId: number | undefined,
  label: string | undefined,
  setDialog: (d: { url: string; photoCount: number }) => void,
) {
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoIds: ids.length ? ids : undefined, albumId, label }),
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
        title: label ?? 'Fotos compartidas',
        text: `${photoCount} ${photoCount === 1 ? 'foto' : 'fotos'}`,
        url,
      });
      return;
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
    }
  }
  setDialog({ url, photoCount });
}
