'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconCalendar, IconX } from '@/components/Icons';

interface BannerPhoto {
  id: number;
  filename: string;
}

interface TodayBannerProps {
  hasMemories: boolean;
  total: number;
  yearList: number[];
  previewPhotos: BannerPhoto[];
}

const DISMISSED_KEY = 'memories-banner-dismissed';

function getDismissedDate(): string | null {
  try { return localStorage.getItem(DISMISSED_KEY); } catch { return null; }
}

function setDismissedDate(date: string) {
  try { localStorage.setItem(DISMISSED_KEY, date); } catch { /* */ }
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TodayBanner({ hasMemories, total, yearList, previewPhotos }: TodayBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasMemories) return;
    if (getDismissedDate() !== todayKey()) setVisible(true);
  }, [hasMemories]);

  if (!visible) return null;

  function dismiss() {
    setDismissedDate(todayKey());
    setVisible(false);
  }

  const yearsLabel = yearList.map(y => {
    const diff = new Date().getFullYear() - y;
    return `hace ${diff} año${diff !== 1 ? 's' : ''}`;
  }).join(', ');

  return (
    <div className="memories-banner">
      <Link href="/memories" className="memories-banner-content">
        <div className="memories-banner-icon">
          <IconCalendar size={16} />
        </div>
        <div className="memories-banner-text">
          <span className="memories-banner-title">Un día como hoy</span>
          <span className="memories-banner-sub">
            {yearsLabel} · {total} foto{total !== 1 ? 's' : ''}
          </span>
        </div>
        {previewPhotos.length > 0 && (
          <div className="memories-banner-thumbs">
            {previewPhotos.map(p => (
              <div key={p.id} className="memories-banner-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${p.id}/thumbnail?size=80`}
                  alt={p.filename}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            ))}
          </div>
        )}
      </Link>
      <button className="memories-banner-close" onClick={dismiss} aria-label="Cerrar">
        <IconX size={10} />
      </button>
    </div>
  );
}
