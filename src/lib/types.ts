export interface Photo {
  id: number;
  path: string;
  filename: string;
  year: number;
  event: string;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  taken_at: string | null;
  camera: string | null;
  exposure: string | null;
  iso: number | null;
  aperture: number | null;
  shutter_speed_seconds: number | null;
  focal_length: number | null;
  gps_lat: number | null;
  gps_lon: number | null;
  is_favorite: number;
  created_at: string;
  scanned_at: string;
}

export interface Tag {
  id: number;
  name: string;
  source: 'manual' | 'ai';
}

export interface Theme {
  id: number;
  name: string;
  color: string;
  photo_count?: number;
}

export interface PhotoDetail extends Photo {
  tags: Tag[];
  themes: Theme[];
}

/** Grupo año/evento tal como lo devuelve listGroups y lo consumen los grids. */
export interface EventGroup {
  year: number;
  event: string;
  count: number;
  /** ID de una foto del grupo — para renderizar la miniatura de carpeta. */
  thumbnail_id: number;
}

/** Filtros activos de la URL de biblioteca (todos opcionales, valores en crudo). */
export interface ActiveFilters {
  year?: string;
  event?: string;
  theme?: string;
  tag?: string;
  favorite?: string;
  untagged?: string;
  q?: string;
  iso_max?: string;
  aperture_max?: string;
  focal_min?: string;
  focal_max?: string;
  camera?: string;
}

// Re-export para que los componentes no acoplen su firma a la capa de queries
export type { CatalogRow } from '@/lib/queries/catalogs';

// ── EPIC-004: Análisis de estilo fotográfico ──────────────────────────────────

export interface StyleSignals {
  photoId: number;
  focalLength: number | null;
  aperture: number | null;
  iso: number | null;
  shutterSpeed: number | null;
  capturedAt: string | null;
  camera: string | null;
  lens: string | null;
  genre: string | null;
}

export interface PeriodStyleSummary {
  period: string;
  photoCount: number;
  topFocalLengths: number[];   // e.g. [35, 50, 85] — most used, discrete values
  topApertures: number[];      // e.g. [1.4, 2.0, 2.8]
  topIsos: number[];           // e.g. [100, 400, 1600]
  avgHourOfDay: number | null; // hour-of-day average still meaningful
  topCamera: string | null;
  topLens: string | null;
  topGenres: string[];
  topTags: string[];
}

export interface StyleProfile {
  id: number;
  period: string;
  type: 'monthly' | 'annual_historical';
  profileText: string | null;
  highlights: string[];
  trend: string | null;
  periodSummary: PeriodStyleSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface BootstrapProgress {
  total: number;
  done: number;
  percent: number;
}
