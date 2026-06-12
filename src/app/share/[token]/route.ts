import { NextRequest, NextResponse } from 'next/server';
import { getShareToken, markShareTokenUsed, isShareTokenExhausted, cleanExpiredShareTokens } from '@/lib/queries/share';
import { getPhotoPathById } from '@/lib/queries/photos';
import { resolvePhotoPath } from '@/lib/config';
import fs from 'fs';
import path from 'path';
import * as archiver from 'archiver';
import { PassThrough, Readable } from 'stream';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Clean stale tokens opportunistically
  cleanExpiredShareTokens();

  const shareToken = getShareToken(token);

  if (!shareToken) {
    return new NextResponse(errorPage('Este enlace no existe o ya fue eliminado.'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  if (shareToken.expires_at < now) {
    return new NextResponse(errorPage('Este enlace ha caducado.'), {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Tras el primer uso, el token admite reintentos durante una ventana corta
  // (descargas grandes cortadas a la mitad); pasada la ventana queda agotado.
  if (isShareTokenExhausted(shareToken, now)) {
    return new NextResponse(errorPage('La ventana de descarga de este enlace ya terminó. Pide al propietario que genere uno nuevo.'), {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const photoIds = JSON.parse(shareToken.photo_ids) as number[];

  // Resolve all photo paths before streaming
  const photos: { absPath: string; filename: string }[] = [];
  for (const id of photoIds) {
    const photo = getPhotoPathById(id);
    if (!photo) continue;
    try {
      const absPath = resolvePhotoPath(photo.path, photo.catalog_path);
      if (!fs.existsSync(absPath)) continue;
      photos.push({ absPath, filename: photo.filename });
    } catch {
      // Skip photos that fail path validation
    }
  }

  if (photos.length === 0) {
    return new NextResponse(errorPage('No se encontraron las fotos de este enlace.'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Marca el primer uso antes del streaming: abre la ventana de reintentos
  // sin desplazarla en descargas posteriores (no-op si used_at ya está fijado)
  markShareTokenUsed(token);

  const label = shareToken.label ?? 'photoshelf-share';
  const safeName = label.replace(/[^a-zA-Z0-9_\-]/g, '_');

  // Build ZIP in memory via PassThrough, convert Node stream → Web ReadableStream
  const passThrough = new PassThrough();

  const archive = archiver('zip', { zlib: { level: 0 } });
  archive.pipe(passThrough);

  for (const { absPath, filename } of photos) {
    const ext = path.extname(filename).toLowerCase();
    const store = ['.jpg', '.jpeg', '.heic', '.heif', '.tif', '.tiff'].includes(ext);
    archive.append(fs.createReadStream(absPath), { name: filename, store });
  }

  // finalize() triggers the data flow; errors propagate through the stream
  archive.finalize().catch((err: unknown) => {
    console.error('[share] ZIP archive error:', err);
    passThrough.destroy(err instanceof Error ? err : new Error(String(err)));
  });

  // Readable.toWeb() gives Next.js a proper Web ReadableStream (Node 18+)
  const webStream = Readable.toWeb(passThrough) as ReadableStream;

  return new NextResponse(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Enlace no disponible — photoshelf</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #0e0e10; color: #e0e0e0; }
    .card { text-align: center; padding: 2rem; max-width: 400px; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #888; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Enlace no disponible</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
