import fs from 'fs';
import path from 'path';
import { scanLibrary } from './scanner';
import { getScanState, updateScanState } from './scanState';
import { getClassifyState, updateClassifyState } from './classifyState';
import { getWatcherState, updateWatcherState } from './watcherState';
import { getDb } from './db';

const PHOTOS_PATH = process.env.PHOTOS_PATH ?? '/photos';
const DEBOUNCE_MS = 5_000;
const POLL_MS = 30_000;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let fsWatcher: fs.FSWatcher | null = null;
let knownDirs: Set<string> = new Set();
let started = false;

async function buildDirSnapshot(root: string): Promise<Set<string>> {
  const result = new Set<string>();
  try {
    const years = await fs.promises.readdir(root).catch(() => [] as string[]);
    for (const year of years) {
      if (isNaN(parseInt(year, 10))) continue;
      const yearPath = path.join(root, year);
      const yStat = await fs.promises.stat(yearPath).catch(() => null);
      if (!yStat?.isDirectory()) continue;
      result.add(year);
      const events = await fs.promises.readdir(yearPath).catch(() => [] as string[]);
      for (const ev of events) {
        const evStat = await fs.promises.stat(path.join(yearPath, ev)).catch(() => null);
        if (evStat?.isDirectory()) result.add(`${year}/${ev}`);
      }
    }
  } catch {}
  return result;
}

function findNewDirs(prev: Set<string>, current: Set<string>): string[] {
  const result: string[] = [];
  current.forEach(d => { if (!prev.has(d)) result.push(d); });
  return result;
}

function scheduleAutoScan(reason: string) {
  if (!getWatcherState().enabled) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runAutoScan(reason), DEBOUNCE_MS);
}

async function runAutoScan(reason: string) {
  if (!getWatcherState().enabled) return;
  if (getScanState().running) return;

  console.log(`[watcher] Auto-scan triggered: ${reason}`);
  updateWatcherState({ lastScanAt: Date.now(), reason });

  updateScanState({
    running: true,
    currentEvent: `Auto-escaneo: ${reason}`,
    done: 0,
    total: 0,
    error: null,
    completedAt: null,
  });

  try {
    await scanLibrary(PHOTOS_PATH, (event, done, total) => {
      updateScanState({ currentEvent: event, done, total });
    });
    updateScanState({ running: false, completedAt: Date.now() });
    console.log('[watcher] Auto-scan completed');
  } catch (err) {
    updateScanState({ running: false, error: String(err) });
    console.error('[watcher] Auto-scan error:', err);
    return;
  }

  // Refresh snapshot after scan
  knownDirs = await buildDirSnapshot(PHOTOS_PATH);

  // Auto-classify only if Ollama is configured
  if (!process.env.OLLAMA_URL) return;
  if (getClassifyState().running) return;

  runAutoClassify().catch(err => console.error('[watcher] Auto-classify error:', err));
}

async function runAutoClassify() {
  const db = getDb();
  const photos = db.prepare(`
    SELECT p.id, p.path FROM photos p
    WHERE NOT EXISTS (
      SELECT 1 FROM photo_tags pt WHERE pt.photo_id = p.id AND pt.source = 'ai'
    )
    ORDER BY p.id DESC
    LIMIT 200
  `).all() as { id: number; path: string }[];

  if (photos.length === 0) return;

  const { classifyPhoto } = await import('./ollama');

  updateWatcherState({ classifying: true, classifyDone: 0, classifyTotal: photos.length });
  updateClassifyState({
    running: true, year: null, currentEvent: 'Auto-clasificando nuevas fotos…',
    done: 0, total: photos.length, error: null, completedAt: null,
  });

  const insertTag = db.transaction((pid: number, tags: string[]) => {
    for (const name of tags) {
      db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name);
      const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: number };
      db.prepare('INSERT OR IGNORE INTO photo_tags (photo_id, tag_id, source) VALUES (?, ?, ?)').run(pid, tag.id, 'ai');
    }
  });

  let done = 0;
  for (const photo of photos) {
    try {
      const tags = await classifyPhoto(photo.path, PHOTOS_PATH);
      if (tags.length > 0) insertTag(photo.id, tags);
    } catch { /* skip failed photo */ }
    done++;
    updateWatcherState({ classifyDone: done });
    updateClassifyState({ done, currentEvent: photo.path });
  }

  updateClassifyState({ running: false, completedAt: Date.now(), done, currentEvent: '' });
  updateWatcherState({ classifying: false, classifyDone: 0, classifyTotal: 0 });
  console.log(`[watcher] Auto-classify done: ${done} photos`);
}

async function pollForChanges() {
  if (!getWatcherState().enabled) return;
  const current = await buildDirSnapshot(PHOTOS_PATH);
  const newDirs = findNewDirs(knownDirs, current);
  if (newDirs.length > 0) {
    const label = newDirs.length === 1 ? newDirs[0] : `${newDirs.length} nuevas carpetas`;
    console.log(`[watcher] Poll detected new dirs: ${newDirs.join(', ')}`);
    knownDirs = current;
    scheduleAutoScan(label);
  }
}

export async function startWatcher(): Promise<void> {
  if (started) return;
  started = true;

  // Ensure photos path exists before watching
  try {
    await fs.promises.access(PHOTOS_PATH);
  } catch {
    console.log(`[watcher] PHOTOS_PATH not accessible (${PHOTOS_PATH}), watcher idle`);
    updateWatcherState({ watching: false });
    return;
  }

  knownDirs = await buildDirSnapshot(PHOTOS_PATH);
  updateWatcherState({ watching: true });
  console.log(`[watcher] Started watching ${PHOTOS_PATH} (${knownDirs.size} dirs known)`);

  // Try fs.watch with recursive (macOS + Windows). Falls back to poll-only on Linux.
  try {
    fsWatcher = fs.watch(PHOTOS_PATH, { recursive: true }, async (_evt, filename) => {
      if (!filename) return;
      // Only care about directory-level additions
      const parts = filename.split(path.sep);
      if (parts.length < 2) return; // not deep enough to be year/event

      const current = await buildDirSnapshot(PHOTOS_PATH);
      const newDirs = findNewDirs(knownDirs, current);
      if (newDirs.length > 0) {
        knownDirs = current;
        const label = newDirs.length === 1 ? newDirs[0] : `${newDirs.length} nuevas carpetas`;
        scheduleAutoScan(label);
      }
    });
    fsWatcher.on('error', () => { /* ignore errors — polling covers us */ });
  } catch {
    console.log('[watcher] fs.watch recursive not supported — polling only');
  }

  // Polling as primary mechanism on Linux and as backup elsewhere
  pollTimer = setInterval(pollForChanges, POLL_MS);
}

export function stopWatcher(): void {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (fsWatcher) { fsWatcher.close(); fsWatcher = null; }
  started = false;
  updateWatcherState({ watching: false });
}

export function setWatcherEnabled(enabled: boolean): void {
  updateWatcherState({ enabled });
  if (!enabled && debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
