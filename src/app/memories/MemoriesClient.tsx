'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { IconChevronLeft, IconChevronRight, IconSparkle, IconCalendar } from '@/components/Icons';
import Sidebar from '@/components/Sidebar';
import type { Photo, Theme } from '@/lib/types';
import type { CatalogRow } from '@/lib/queries/catalogs';

interface MemoryYear {
  year: number;
  count: number;
  photos: Photo[];
}

interface MemoriesData {
  date: string;
  years: MemoryYear[];
  total: number;
}

interface MemoriesClientProps {
  initialData: MemoriesData;
  initialDate: string;
  themes: Theme[];
  projects: { id: number; title: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs?: CatalogRow[];
  activeCatalogId?: number;
}

function formatDateLabel(date: string): string {
  const [mm, dd] = date.split('-');
  const d = new Date(2000, parseInt(mm) - 1, parseInt(dd));
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}

function offsetDate(date: string, delta: number): string {
  const [mm, dd] = date.split('-').map(Number);
  const d = new Date(2000, mm - 1, dd + delta);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MemoriesClient({
  initialData,
  initialDate,
  themes,
  projects,
  totalPhotos,
  favoriteCount,
  untaggedCount,
  catalogs = [],
  activeCatalogId = 1,
}: MemoriesClientProps) {
  const router = useRouter();
  const [data, setData] = useState<MemoriesData>(initialData);
  const [date, setDate] = useState(initialDate);
  const [loading, setLoading] = useState(false);
  const [narratives, setNarratives] = useState<Record<number, string>>({});
  const [generatingYear, setGeneratingYear] = useState<number | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);


  const loadDate = useCallback(async (newDate: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/memories?date=${newDate}`);
      if (!res.ok) throw new Error('Error loading memories');
      const result = await res.json() as MemoriesData;
      setData(result);
      setDate(newDate);
      router.replace(`/memories?date=${newDate}`, { scroll: false });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  function goTo(delta: number) {
    loadDate(offsetDate(date, delta));
  }

  async function generateNarrative(year: number) {
    setGeneratingYear(year);
    try {
      const res = await fetch('/api/memories/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, year }),
      });
      const body = await res.json() as { narrative?: string; error?: string };
      if (body.narrative) setNarratives(prev => ({ ...prev, [year]: body.narrative! }));
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingYear(null);
    }
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes}
        projects={projects}
        totalPhotos={totalPhotos}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        catalogs={catalogs}
        activeCatalogId={activeCatalogId}
      />
      <div className="main">
        <div className="memories-page">
          <div className="memories-header">
            <button className="memories-nav-btn" onClick={() => goTo(-1)} disabled={loading}>
              <IconChevronLeft size={16} />
            </button>
            <div className="memories-header-center">
              <IconCalendar size={16} />
              <h1 className="memories-title">{formatDateLabel(date)}</h1>
            </div>
            <button className="memories-nav-btn" onClick={() => goTo(1)} disabled={loading}>
              <IconChevronRight size={16} />
            </button>
          </div>

          {loading && <div className="memories-loading">Cargando…</div>}

          {!loading && data.total === 0 && (
            <div className="memories-empty">
              <IconCalendar size={32} />
              <p>No hay fotos de años anteriores para este día.</p>
            </div>
          )}

          {!loading && data.years.map(yearGroup => {
            const diff = currentYear - yearGroup.year;
            return (
              <div key={yearGroup.year} className="memories-year-group">
                <div className="memories-year-header">
                  <span className="memories-year-label">{yearGroup.year}</span>
                  <span className="memories-year-sub">
                    hace {diff} año{diff !== 1 ? 's' : ''} · {yearGroup.count} foto{yearGroup.count !== 1 ? 's' : ''}
                  </span>
                  {yearGroup.count >= 5 && !narratives[yearGroup.year] && (
                    <button
                      className="memories-narrative-btn"
                      onClick={() => generateNarrative(yearGroup.year)}
                      disabled={generatingYear === yearGroup.year}
                    >
                      <IconSparkle size={12} />
                      {generatingYear === yearGroup.year ? 'Generando…' : 'Generar narrativa'}
                    </button>
                  )}
                </div>
                {narratives[yearGroup.year] && (
                  <p className="memories-narrative">{narratives[yearGroup.year]}</p>
                )}
                <div className="memories-photo-grid">
                  {yearGroup.photos.map(photo => (
                    <div key={photo.id} className="memories-photo-cell">
                      <Image
                        src={`/api/photos/${photo.id}/thumbnail`}
                        alt={photo.filename}
                        fill
                        sizes="(max-width: 768px) 33vw, 20vw"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

