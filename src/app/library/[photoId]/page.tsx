import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import Sidebar from '@/components/Sidebar';
import DetailPanel from '@/components/DetailPanel';
import { IconChevronLeft, IconChevronRight } from '@/components/Icons';
import type { PhotoDetail, Theme } from '@/lib/types';

interface Params { photoId: string }
interface SearchParams { year?: string; theme?: string; favorite?: string; q?: string }

export default async function PhotoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const { photoId } = await params;
  const sp = await searchParams;
  const db = getDb();
  const id = parseInt(photoId, 10);

  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as PhotoDetail | undefined;
  if (!photo) notFound();

  photo.tags = db.prepare(
    'SELECT t.id, t.name, pt.source FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.photo_id = ?'
  ).all(id) as PhotoDetail['tags'];

  photo.themes = db.prepare(
    'SELECT th.id, th.name, th.color FROM photo_themes pt JOIN themes th ON th.id = pt.theme_id WHERE pt.photo_id = ?'
  ).all(id) as Theme[];

  const allThemes = db.prepare(`
    SELECT th.id, th.name, th.color, COUNT(pt.photo_id) as photo_count
    FROM themes th
    LEFT JOIN photo_themes pt ON pt.theme_id = th.id
    GROUP BY th.id ORDER BY th.name ASC
  `).all() as Theme[];

  // Sidebar data
  const total = (db.prepare('SELECT COUNT(*) as c FROM photos').get() as { c: number }).c;
  const favoriteCount = (db.prepare('SELECT COUNT(*) as c FROM photos WHERE is_favorite = 1').get() as { c: number }).c;
  const untaggedCount = (db.prepare('SELECT COUNT(*) as c FROM photos p WHERE NOT EXISTS (SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id)').get() as { c: number }).c;
  const years = (db.prepare('SELECT DISTINCT year FROM photos ORDER BY year DESC').all() as { year: number }[]).map(r => r.year);

  // Prev / next within the same event
  const siblings = db.prepare(
    'SELECT id FROM photos WHERE year = ? AND event = ? ORDER BY taken_at ASC, filename ASC'
  ).all(photo.year, photo.event) as { id: number }[];
  const idx = siblings.findIndex((s) => s.id === id);
  const prevId = idx > 0 ? siblings[idx - 1].id : null;
  const nextId = idx < siblings.length - 1 ? siblings[idx + 1].id : null;

  const backParams = new URLSearchParams(sp as Record<string, string>).toString();
  const backHref = `/library${backParams ? `?${backParams}` : ''}`;
  const navParams = backParams ? `?${backParams}` : '';

  return (
    <div className="app-shell">
      <Sidebar
        themes={allThemes}
        totalPhotos={total}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
      />

      <div className="main">
        <div className="detail-topbar">
          <Link href={backHref} className="btn-back">
            <IconChevronLeft />
            {photo.event}
          </Link>
          <span style={{ color: 'var(--text-tertiary)' }}>/</span>
          <span className="detail-filename">{photo.filename}</span>

          <div className="detail-nav">
            {prevId ? (
              <Link href={`/library/${prevId}${navParams}`} className="btn-icon">
                <IconChevronLeft />
              </Link>
            ) : (
              <button className="btn-icon" disabled style={{ opacity: 0.3 }}><IconChevronLeft /></button>
            )}
            {nextId ? (
              <Link href={`/library/${nextId}${navParams}`} className="btn-icon">
                <IconChevronRight />
              </Link>
            ) : (
              <button className="btn-icon" disabled style={{ opacity: 0.3 }}><IconChevronRight /></button>
            )}
          </div>
        </div>

        <div className="detail-body">
          <div className="detail-photo-area">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${photo.id}/thumbnail?size=1920&fit=inside`}
              alt={photo.filename}
            />
            <a
              href={`/api/photos/${photo.id}/original`}
              download={photo.filename}
              className="download-original-btn"
              title="Descargar original"
            >
              ↓ Original
            </a>
          </div>

          <DetailPanel photo={photo} allThemes={allThemes} />
        </div>
      </div>
    </div>
  );
}
