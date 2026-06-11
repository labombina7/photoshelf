// Shared logic for direct photo sharing and link fallback.
// Used by ShareButton and ShareEventItem (PhotoGrid).

const DIRECT_SHARE_LIMIT = 10;
const SHARE_THUMB_SIZE = 1920;

/**
 * Share `ids` photos. Uses Web Share API with files when ≤ DIRECT_SHARE_LIMIT
 * and the browser supports it; otherwise generates a share link.
 *
 * Returns the share URL if a link was created (useful for showing a dialog),
 * or null if files were shared directly or the user cancelled.
 */
export async function sharePhotos(
  ids: number[],
  label?: string,
  albumId?: number,
): Promise<{ url: string; photoCount: number } | null> {
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    !!navigator.share &&
    !!navigator.canShare &&
    ids.length > 0 &&
    ids.length <= DIRECT_SHARE_LIMIT;

  if (canShareFiles) {
    const files = await fetchAsFiles(ids);
    if (files && navigator.canShare({ files })) {
      try {
        await navigator.share({
          files,
          title: label ?? 'Fotos',
          text: `${files.length} ${files.length === 1 ? 'foto' : 'fotos'}`,
        });
        return null;
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return null;
        // Fall through to link
      }
    }
  }

  return shareViaLink(ids, albumId, label);
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
): Promise<{ url: string; photoCount: number } | null> {
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoIds: ids.length ? ids : undefined, albumId, label }),
  });
  const data = await res.json() as { url?: string; photoCount?: number; error?: string };
  if (!res.ok || !data.url) {
    alert(data.error ?? 'Error al generar el enlace');
    return null;
  }
  const { url, photoCount = 0 } = data;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: label ?? 'Fotos compartidas',
        text: `${photoCount} ${photoCount === 1 ? 'foto' : 'fotos'}`,
        url,
      });
      return null;
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return null;
    }
  }

  return { url, photoCount };
}
