'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Photo, Tag } from '@/lib/types';

interface PhotoWithTags extends Photo {
  tags: Tag[];
}

interface EventGroup {
  year: number;
  event: string;
  photos: PhotoWithTags[];
}

interface PhotoGridProps {
  groups: EventGroup[];
}

export default function PhotoGrid({ groups }: PhotoGridProps) {
  const searchParams = useSearchParams();
  const currentParams = searchParams.toString();

  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.3 }}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <p>No hay fotos. Haz clic en &ldquo;Reescanear biblioteca&rdquo; para comenzar.</p>
      </div>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <div key={`${group.year}-${group.event}`} className="event-block">
          <div className="event-label">
            <span className="event-name">{group.event}</span>
            <span className="event-count">· {group.photos.length} fotos</span>
          </div>
          <div className="photo-grid">
            {group.photos.map((photo) => {
              const previewTags = photo.tags.slice(0, 2);
              return (
                <Link
                  key={photo.id}
                  href={`/library/${photo.id}${currentParams ? `?${currentParams}` : ''}`}
                  className="photo-item"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/photos/${photo.id}/thumbnail`}
                    alt={photo.filename}
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {previewTags.length > 0 && (
                    <div className="photo-overlay">
                      {previewTags.map((tag) => (
                        <span key={tag.name} className={`photo-tag-chip ${tag.source === 'ai' ? 'auto' : ''}`}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
