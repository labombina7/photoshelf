/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', 'sharp', 'exifr', 'heic-convert'],
};

export default nextConfig;
