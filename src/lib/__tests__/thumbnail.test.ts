import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

// Mock sharp (dynamic import in thumbnail.ts)
vi.mock('sharp', () => {
  const sharpInstance = {
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-webp-data')),
  };
  const sharpFn = vi.fn().mockReturnValue(sharpInstance);
  return { default: sharpFn };
});

// Mock heic-convert (dynamic import in thumbnail.ts)
vi.mock('heic-convert', () => ({
  default: vi.fn().mockResolvedValue(Buffer.from('fake-jpeg-from-heic')),
}));

// Mock @/lib/config
vi.mock('@/lib/config', () => ({
  resolvePhotoPath: vi.fn(),
  PHOTOS_PATH: '/photos',
}));

import fs from 'fs/promises';
import { resolvePhotoPath } from '@/lib/config';
import { getThumbnail } from '@/lib/thumbnail';

const mockReadFile = vi.mocked(fs.readFile);
const mockWriteFile = vi.mocked(fs.writeFile);
const mockMkdir = vi.mocked(fs.mkdir);
const mockResolvePhotoPath = vi.mocked(resolvePhotoPath);

beforeEach(() => {
  vi.clearAllMocks();
  mockMkdir.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);
});

describe('getThumbnail', () => {
  it('serves from cache when the thumbnail already exists on disk', async () => {
    const cachedBuffer = Buffer.from('cached-webp-content');

    // First readFile call (cache check) succeeds
    mockReadFile.mockResolvedValueOnce(cachedBuffer);

    const result = await getThumbnail('2024/evento/foto.jpg', '/photos');

    expect(result.buffer).toBe(cachedBuffer);
    expect(result.contentType).toBe('image/webp');

    // resolvePhotoPath should NOT be called when serving from cache
    expect(mockResolvePhotoPath).not.toHaveBeenCalled();
  });

  it('generates a WebP thumbnail for a JPEG input (uses sharp)', async () => {
    const imageBuffer = Buffer.from('fake-jpeg-data');

    // First readFile (cache check) fails → cache miss
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
    // Second readFile (reading the actual image) succeeds
    mockReadFile.mockResolvedValueOnce(imageBuffer);

    mockResolvePhotoPath.mockReturnValue('/photos/2024/evento/foto.jpg');

    const result = await getThumbnail('2024/evento/foto.jpg', '/photos', 400, 'cover');

    expect(result.contentType).toBe('image/webp');
    expect(result.buffer).toEqual(Buffer.from('fake-webp-data'));

    // sharp should have been called with the image buffer
    const sharp = (await import('sharp')).default;
    expect(sharp).toHaveBeenCalledWith(imageBuffer);

    // Thumbnail should be cached to disk
    expect(mockWriteFile).toHaveBeenCalledOnce();
  });

  it('throws when resolvePhotoPath raises (path traversal)', async () => {
    // Cache miss
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));

    // resolvePhotoPath throws for path traversal
    mockResolvePhotoPath.mockImplementation(() => {
      throw new Error('Path traversal detected');
    });

    await expect(getThumbnail('../secret.txt', '/photos')).rejects.toThrow('Path traversal detected');
  });

  it('uses "inside" fit mode when requested', async () => {
    const imageBuffer = Buffer.from('fake-jpeg-data');

    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
    mockReadFile.mockResolvedValueOnce(imageBuffer);

    mockResolvePhotoPath.mockReturnValue('/photos/2024/evento/foto.jpg');

    await getThumbnail('2024/evento/foto.jpg', '/photos', 800, 'inside');

    const sharp = (await import('sharp')).default;
    const sharpInstance = (sharp as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;

    // resize should have been called with the inside fit option
    expect(sharpInstance.resize).toHaveBeenCalledWith(
      expect.objectContaining({ fit: 'inside' })
    );
  });
});
