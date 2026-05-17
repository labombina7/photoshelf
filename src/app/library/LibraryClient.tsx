'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PhotoGrid from '@/components/PhotoGrid';
import { IconSearch } from '@/components/Icons';
import type { Theme } from '@/lib/types';

interface PhotoWithTags {
  id: number;
  path: string;
  filename: string;
  year: number;
  event: string;
  is_favorite: number;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  taken_at: string | null;
  camera: string | null;
  exposure: string | null;
  gps_lat: number | null;
  gps_lon: number | null;
  created_at: string;
  scanned_at: string;
  tags: { name: string; source: 'manual' | 'ai'; id: number }[];
}

interface LibraryClientProps {
  photos: PhotoWithTags[];
  total: number;
  years: number[];
  themes: Theme[];
  favoriteCount: number;
  untaggedCount: number;
  activeYear: string | null;
}

export default function LibraryClient({
  photos,
  total,
  years,
  themes,
  favoriteCount,
  untaggedCount,
  activeYear,
}: LibraryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState('');
  const [_isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  async function handleScan() {
    setScanning(true);
    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      const data = await res.json();
      showToast(`Escaneo completado: ${data.added} fotos nuevas (total: ${data.total})`);
      startTransition(() => router.refresh());
    } catch {
      showToast('Error al escanear la biblioteca');
    } finally {
      setScanning(false);
    }
  }

  function setYear(year: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (year) params.set('year', year);
    else params.delete('year');
    params.delete('event');
    router.push(`/library?${params.toString()}`);
  }

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) params.set('q', query.trim());
    else params.delete('q');
    router.push(`/library?${params.toString()}`);
  }, [query, router, searchParams]);

  // Group photos by event
  const groups: { year: number; event: string; photos: PhotoWithTags[] }[] = [];
  for (const photo of photos) {
    const last = groups[groups.length - 1];
    if (last && last.year === photo.year && last.event === photo.event) {
      last.photos.push(photo);
    } else {
      groups.push({ year: photo.year, event: photo.event, photos: [photo] });
    }
  }

  const titleParts: string[] = [];
  const themeId = searchParams.get('theme');
  const fav = searchParams.get('favorite');
  const activeThemeName = themes.find(t => String(t.id) === themeId)?.name;
  if (fav) titleParts.push('Favoritos');
  else if (activeThemeName) titleParts.push(activeThemeName);
  else if (activeYear) titleParts.push(activeYear);
  else titleParts.push('Todas las fotos');

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes}
        totalPhotos={total}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        onScan={handleScan}
        scanning={scanning}
      />

      <div className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">{titleParts[0]}</div>
          </div>
          <span className="topbar-sub">{photos.length.toLocaleString('es')} fotos</span>
          <div className="topbar-spacer" />
          <form onSubmit={handleSearch}>
            <div className="search-box">
              <IconSearch />
              <input
                placeholder="Buscar fotos, tags, eventos…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </form>
        </div>

        <div className="content">
          {/* Year tabs */}
          {years.length > 1 && (
            <div className="year-tabs">
              <button
                className={`year-tab ${!activeYear ? 'active' : ''}`}
                onClick={() => setYear(null)}
              >
                Todos
              </button>
              {years.map((y) => (
                <button
                  key={y}
                  className={`year-tab ${activeYear === String(y) ? 'active' : ''}`}
                  onClick={() => setYear(String(y))}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          <PhotoGrid groups={groups} />
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
