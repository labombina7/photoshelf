/**
 * Background sync loop: reads unsynced photos in batches of 100 and sends them to Amplitude.
 */

import { buildPhotoEvent, sendEvents, isAmplitudeConfigured } from './amplitude';
import { getUnsyncedPhotos, markPhotosAsSynced } from './queries/amplitude';

const g = globalThis as typeof globalThis & { __amplitude_sync_running?: boolean };

export async function syncPendingPhotosToAmplitude(): Promise<void> {
  if (!isAmplitudeConfigured()) return;
  if (g.__amplitude_sync_running) return;
  g.__amplitude_sync_running = true;

  try {
    while (true) {
      const photos = getUnsyncedPhotos(100);
      if (photos.length === 0) break;

      const events = photos.map(buildPhotoEvent);
      const ok = await sendEvents(events);

      if (!ok) {
        console.error(`[amplitude-sync] Batch failed, will retry next cycle`);
        break;
      }

      markPhotosAsSynced(photos.map(p => p.id));
      console.log(`[amplitude-sync] Synced ${photos.length} photos`);

      if (photos.length < 100) break; // done
    }
  } finally {
    g.__amplitude_sync_running = false;
  }
}
