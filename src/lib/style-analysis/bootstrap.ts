import { callOllama } from '@/lib/ollama';
import { extractJsonObject } from '@/lib/ollama';
import {
  initBootstrapIfEmpty,
  getPendingBootstrapRows,
  updateBootstrapRow,
  getBootstrapProgress,
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
    raw = await callOllama(prompt, 60_000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[style-bootstrap] Ollama failed for period', row.period, ':', msg);
    // Reset to pending so it can be retried
    updateBootstrapRow(row.period, { status: 'pending' });
    return;
  }

  let parsed: { narrative: string; highlights: string[]; trend: string };
  try {
    parsed = extractJsonObject(raw) as typeof parsed;
    if (!parsed?.narrative) throw new Error('missing narrative');
  } catch {
    console.error('[style-bootstrap] Failed to parse Ollama response for period', row.period);
    updateBootstrapRow(row.period, { status: 'pending' });
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
