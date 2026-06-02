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

export interface EventGroup {
  year: number;
  event: string;
  photos: Photo[];
  count: number;
}
