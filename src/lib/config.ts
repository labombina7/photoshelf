import path from 'path';

export const PHOTOS_PATH = process.env.PHOTOS_PATH ?? '/photos';

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
