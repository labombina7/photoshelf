'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface EventGroup {
  year: number;
  event: string;
  count: number;
  thumbnail_id: number;
}

interface FolderGridProps {
  groups: EventGroup[];
  showYear: boolean;
}

export default function FolderGrid({ groups, showYear }: FolderGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function openFolder(group: EventGroup) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', String(group.year));
    params.set('event', group.event);
    router.push(`/library?${params.toString()}`);
  }

  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.3 }}>
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        <p>No hay carpetas.</p>
      </div>
    );
  }

  return (
    <div className="folder-grid">
      {groups.map((group) => (
        <div
          key={`${group.year}-${group.event}`}
          className="folder-card"
          onDoubleClick={() => openFolder(group)}
          title={`Doble clic para abrir "${group.event}"`}
        >
          <div className="folder-card-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${group.thumbnail_id}/thumbnail`}
              alt={group.event}
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div className="folder-card-info">
            {showYear && <span className="folder-card-year">{group.year}</span>}
            <span className="folder-card-name">{group.event}</span>
            <span className="folder-card-count">{group.count} fotos</span>
          </div>
        </div>
      ))}
    </div>
  );
}
