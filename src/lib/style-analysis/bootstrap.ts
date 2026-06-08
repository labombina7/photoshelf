import { callOllama } from '@/lib/ollama';
import { extractJsonObject } from '@/lib/ollama';
import {
  initBootstrapIfEmpty,
  getPendingBootstrapRows,
  updateBootstrapRow,
  getBootstrapProgress,
  upsertStyleProfileSummaryOnly,
} from '@/lib/queries/style-analysis';
import { selectRepresentativeSample, getStyleSignalsByPeriod } from '@/lib/queries/style-analysis';
import { upsertStyleProfile } from '@/lib/queries/style-analysis';
import { buildHistoricalSamplePrompt, buildMonthlySynthesisPrompt } from './prompts';
import type { BootstrapRow } from '@/lib/queries/style-analysis';

const BOOTSTRAP_DELAY_MS = 2_000;

const g = globalThis as typeof globalThis & { __style_bootstrap_running?: boolean };

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function periodRange(period: string): { from: string; to: string } {
  if (period.length === 4) {
    // Year
    return { from: `${period}-01-01`, to: `${Number(period) + 1}-01-01` };
  }
  // Month YYYY-MM
  const [y, m] = period.split('-').map(Number);
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { from: `${period}-01`, to };
}

async function processRow(row: BootstrapRow): Promise<void> {
  updateBootstrapRow(row.period, { status: 'in_progress' });

  const maxPhotos = row.type === 'historical_sample' ? 30 : 50;
  const { from, to } = periodRange(row.period);

  const sampleIds = selectRepresentativeSample({ from, to, maxPhotos });
  if (sampleIds.length === 0) {
    updateBootstrapRow(row.period, { status: 'done', processed_at: new Date().toISOString(), sample_count: 0 });
    return;
  }

  const summary = getStyleSignalsByPeriod({ from, to });

  const isHistorical = row.type === 'historical_sample';
  const prompt = isHistorical
    ? buildHistoricalSamplePrompt(row.period, summary)
    : buildMonthlySynthesisPrompt(row.period, summary, null);

  let raw: string;
  try {
    raw = await callOllama(prompt, 120_000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[style-bootstrap] Ollama unavailable for period', row.period, ':', msg);
    // Save EXIF stats without narrative so the UI can show them immediately
    upsertStyleProfileSummaryOnly(row.period, isHistorical ? 'annual_historical' : 'monthly', summary);
    updateBootstrapRow(row.period, { status: 'done', processed_at: new Date().toISOString(), sample_count: sampleIds.length });
    return;
  }

  let parsed: { narrative: string; highlights: string[]; trend: string };
  try {
    parsed = extractJsonObject(raw) as unknown as typeof parsed;
    if (!parsed?.narrative) throw new Error('missing narrative');
  } catch {
    console.error('[style-bootstrap] Failed to parse Ollama response for period', row.period, '— raw:', raw?.substring(0, 200));
    // Save EXIF stats without narrative — narrative will be retried later
    upsertStyleProfileSummaryOnly(row.period, isHistorical ? 'annual_historical' : 'monthly', summary);
    updateBootstrapRow(row.period, { status: 'done', processed_at: new Date().toISOString(), sample_count: sampleIds.length });
    return;
  }

  upsertStyleProfile({
    period: row.period,
    type: isHistorical ? 'annual_historical' : 'monthly',
    profileText: parsed.narrative,
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    trend: parsed.trend ?? null,
    periodSummary: summary,
  });

  updateBootstrapRow(row.period, {
    status: 'done',
    processed_at: new Date().toISOString(),
    sample_count: sampleIds.length,
  });

  console.log('[style-bootstrap] Period done:', row.period, `(${sampleIds.length} photos sampled)`);
}

async function isOllamaAvailable(): Promise<boolean> {
  const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3_000);
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/** Saves EXIF stats for all pending rows without calling Ollama. */
function saveAllPendingStats(): void {
  const pending = getPendingBootstrapRows();
  for (const row of pending) {
    updateBootstrapRow(row.period, { status: 'in_progress' });
    const { from, to } = periodRange(row.period);
    const isHistorical = row.type === 'historical_sample';
    const profileType: 'annual_historical' | 'monthly' = isHistorical ? 'annual_historical' : 'monthly';
    const sampleIds = selectRepresentativeSample({ from, to, maxPhotos: isHistorical ? 30 : 50 });
    if (sampleIds.length === 0) {
      updateBootstrapRow(row.period, { status: 'done', processed_at: new Date().toISOString(), sample_count: 0 });
      continue;
    }
    const summary = getStyleSignalsByPeriod({ from, to });
    upsertStyleProfileSummaryOnly(row.period, profileType, summary);
    updateBootstrapRow(row.period, { status: 'done', processed_at: new Date().toISOString(), sample_count: sampleIds.length });
  }
  console.log(`[style-bootstrap] Saved EXIF stats for ${pending.length} periods (Ollama unavailable)`);
}

async function bootstrapLoop(): Promise<void> {
  initBootstrapIfEmpty();

  while (true) {
    const pending = getPendingBootstrapRows();
    if (pending.length === 0) {
      console.log('[style-bootstrap] Bootstrap complete.');
      g.__style_bootstrap_running = false;
      return;
    }

    const progress = getBootstrapProgress();
    console.log(`[style-bootstrap] Progress: ${progress.done}/${progress.total} (${progress.percent}%)`);

    // Quick pre-check: if Ollama is down, save stats for all pending periods at once
    const ollamaUp = await isOllamaAvailable();
    if (!ollamaUp) {
      console.log('[style-bootstrap] Ollama unavailable — saving EXIF stats for all pending periods');
      saveAllPendingStats();
      g.__style_bootstrap_running = false;
      return;
    }

    const row = pending[0];
    await processRow(row);
    await sleep(BOOTSTRAP_DELAY_MS);
  }
}

export function ensureBootstrapRunning(): void {
  if (g.__style_bootstrap_running) return;
  g.__style_bootstrap_running = true;

  // Run with low-priority scheduling — don't block app startup
  setTimeout(() => {
    bootstrapLoop().catch((err) => {
      console.error('[style-bootstrap] Fatal error:', err);
      g.__style_bootstrap_running = false;
      // Retry after 60s
      setTimeout(ensureBootstrapRunning, 60_000);
    });
  }, 5_000);
}

export { getBootstrapProgress };
