import path from 'path';

export const PHOTOS_PATH = process.env.PHOTOS_PATH ?? '/photos';

/**
 * Canonical MIME type map for all image formats supported by photoshelf.
 * Use this instead of local switch/object definitions in route handlers.
 * Falls back to 'application/octet-stream' for unknown extensions.
 */
export const MIME_TYPES: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.tif':  'image/tiff',
  '.tiff': 'image/tiff',
  '.avif': 'image/avif',
};

export const FALLBACK_MIME = 'application/octet-stream';

// ── Ollama timeouts ───────────────────────────────────────────────────────────
export const OLLAMA_TIMEOUT_TEXT_MS     = 30_000;
export const OLLAMA_TIMEOUT_VISION_MS   = 120_000;
export const OLLAMA_TIMEOUT_CLASSIFY_MS = 180_000;
export const OLLAMA_IMAGE_SIZE          = 512;

// ── Folder watcher ────────────────────────────────────────────────────────────
export const WATCHER_DEBOUNCE_MS = 5_000;
export const WATCHER_POLL_MS     = 30_000;

// ── Auth rate limiting ────────────────────────────────────────────────────────
export const AUTH_RATE_LIMIT_ATTEMPTS  = 10;
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1_000;

/**
 * Resolves a relative photo path against photosRoot and validates it doesn't escape the root.
 * Throws an error if the resolved path is outside photosRoot (path traversal attempt).
 *
 * @param relativePath - Path relative to photosRoot (from DB)
 * @param photosRoot   - Absolute path to the photos root directory
 * @returns Absolute, validated path to the file
 */
export function resolvePhotoPath(relativePath: string, photosRoot: string): string {
  const root = path.resolve(photosRoot);
  const absPath = path.resolve(root, relativePath);

  // Must start with root + path.sep to avoid false positives:
  // e.g. root=/photos but absPath=/photos-extra/secret.txt
  if (!absPath.startsWith(root + path.sep) && absPath !== root) {
    throw new Error('Path traversal detected');
  }

  return absPath;
}
