import { getDb } from '@/lib/db';
import type { PhotoForAmplitude } from '@/lib/amplitude';

const BATCH_SIZE = 100;

interface PhotoRow {
  id: number;
  taken_at: string | null;
  created_at: string;
  camera: string | null;
  focal_length: number | null;
  aperture: number | null;
  iso: number | null;
  shutter_speed_seconds: number | null;
  width: number | null;
  height: number | null;
  tag_list: string | null;
  genre: string | null;
}

export interface AmplitudeSyncProgress {
  total: number;
  synced: number;
  percent: number;
}

export function getAmplitudeSyncProgress(): AmplitudeSyncProgress {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COUNT(amplitude_synced_at) AS synced
    FROM photos
  `).get() as { total: number; synced: number };
  const { total, synced } = row;
  return { total, synced, percent: total > 0 ? Math.round((synced / total) * 100) : 0 };
}

export function getUnsyncedPhotos(limit = BATCH_SIZE): PhotoForAmplitude[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      p.id,
      p.taken_at,
      p.created_at,
      p.camera,
      p.focal_length,
      p.aperture,
      p.iso,
      p.shutter_speed_seconds,
      p.width,
      p.height,
      (SELECT GROUP_CONCAT(t.name, ',')
       FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id
       WHERE pt.photo_id = p.id AND pt.source = 'ai') AS tag_list,
      (SELECT t.name
       FROM photo_tags pt JOIN tags t ON t.id = pt.tag_id
       WHERE pt.photo_id = p.id AND pt.source = 'ai'
         AND t.name IN ('retrato','paisaje','arquitectura','street','naturaleza','macro','deporte','noche','abstracto','documental')
       LIMIT 1) AS genre
    FROM photos p
    WHERE p.amplitude_synced_at IS NULL
    ORDER BY p.taken_at ASC
    LIMIT ?
  `).all(limit) as PhotoRow[];

  return rows.map(r => ({
    id:                   r.id,
    taken_at:             r.taken_at,
    created_at:           r.created_at,
    camera:               r.camera,
    focal_length:         r.focal_length,
    aperture:             r.aperture,
    iso:                  r.iso,
    shutter_speed_seconds: r.shutter_speed_seconds,
    width:                r.width,
    height:               r.height,
    genre:                r.genre,
    tags:                 r.tag_list ? r.tag_list.split(',').filter(Boolean) : [],
  }));
}

export function markPhotosAsSynced(ids: number[]): void {
  if (ids.length === 0) return;
  const db = getDb();
  const now = new Date().toISOString();
  const ph = ids.map(() => '?').join(',');
  db.prepare(`UPDATE photos SET amplitude_synced_at = ? WHERE id IN (${ph})`).run(now, ...ids);
}

/** Reset sync state (for re-sync) */
export function resetAmplitudeSync(): void {
  const db = getDb();
  db.prepare(`UPDATE photos SET amplitude_synced_at = NULL`).run();
}
