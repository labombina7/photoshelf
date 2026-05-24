import { describe, it, expect } from 'vitest';
import { resolvePhotoPath } from '@/lib/config';

describe('resolvePhotoPath', () => {
  const root = '/photos';

  it('resolves a valid relative path within the root', () => {
    const result = resolvePhotoPath('2024/evento/foto.jpg', root);
    expect(result).toBe('/photos/2024/evento/foto.jpg');
  });

  it('resolves nested valid path within the root', () => {
    const result = resolvePhotoPath('2023/vacaciones/img001.jpg', root);
    expect(result).toBe('/photos/2023/vacaciones/img001.jpg');
  });

  it('throws on path traversal attempt with ..', () => {
    expect(() => resolvePhotoPath('../secret.txt', root)).toThrow('Path traversal detected');
  });

  it('throws on deep path traversal attempt', () => {
    expect(() => resolvePhotoPath('2024/../../etc/passwd', root)).toThrow('Path traversal detected');
  });

  it('throws when absolute external path is given that escapes root', () => {
    expect(() => resolvePhotoPath('/etc/passwd', root)).toThrow('Path traversal detected');
  });

  it('throws when path resolves exactly to another root that starts with the same prefix', () => {
    // /photos-extra would share prefix with /photos but is outside
    expect(() => resolvePhotoPath('../photos-extra/file.jpg', root)).toThrow('Path traversal detected');
  });
});
