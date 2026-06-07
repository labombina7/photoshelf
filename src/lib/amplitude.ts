/**
 * Amplitude HTTP API v2 client.
 * Reads AMPLITUDE_API_KEY and AMPLITUDE_USER_ID from environment.
 * If AMPLITUDE_API_KEY is not set, all calls are no-ops.
 */

const AMPLITUDE_ENDPOINT = 'https://api.eu.amplitude.com/2/httpapi';

function getApiKey(): string | null {
  return process.env.AMPLITUDE_API_KEY ?? null;
}

function getUserId(): string {
  return process.env.AMPLITUDE_USER_ID ?? 'photoshelf-user';
}

export interface AmplitudeEvent {
  user_id: string;
  insert_id: string;
  event_type: string;
  time: number;
  event_properties: Record<string, unknown>;
}

export interface PhotoForAmplitude {
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
  genre: string | null;
  tags: string[];
}

export function buildPhotoEvent(photo: PhotoForAmplitude): AmplitudeEvent {
  const ts = photo.taken_at ?? photo.created_at;
  const date = ts ? new Date(ts) : new Date();
  const time = date.getTime();

  const props: Record<string, unknown> = {
    camera:        photo.camera,
    focal_length:  photo.focal_length,
    aperture:      photo.aperture,
    iso:           photo.iso,
    shutter_speed: photo.shutter_speed_seconds,
    width:         photo.width,
    height:        photo.height,
    year:          date.getUTCFullYear(),
    month:         date.getUTCMonth() + 1,
    hour_of_day:   date.getUTCHours(),
    day_of_week:   date.getUTCDay(),
    genre:         photo.genre,
    tags:          photo.tags.slice(0, 10),
    has_exif:      photo.focal_length !== null || photo.aperture !== null || photo.iso !== null,
  };

  // Strip nulls so Amplitude charts are cleaner
  for (const key of Object.keys(props)) {
    if (props[key] === null || props[key] === undefined) delete props[key];
  }

  return {
    user_id:          getUserId(),
    insert_id:        `photo_${photo.id}`,
    event_type:       'photo_taken',
    time,
    event_properties: props,
  };
}

/**
 * Send up to 100 events to Amplitude.
 * Returns true on success, false on failure.
 */
export async function sendEvents(events: AmplitudeEvent[]): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) return true; // silently skip if not configured

  if (events.length === 0) return true;

  try {
    const res = await fetch(AMPLITUDE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, events }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[amplitude] HTTP ${res.status}: ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[amplitude] sendEvents error:', err);
    return false;
  }
}

export function isAmplitudeConfigured(): boolean {
  return Boolean(getApiKey());
}
