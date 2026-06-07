import { callOllama } from '@/lib/ollama';
import { extractJsonObject } from '@/lib/ollama';
import {
  accumulatePendingSignals,
  consumePendingSignalsForMonth,
  getLastDailyRun,
  setLastDailyRun,
  getStyleProfile,
  getLatestProfiles,
  upsertStyleProfile,
} from '@/lib/queries/style-analysis';
import { getStyleSignalsByPeriod, selectRepresentativeSample } from '@/lib/queries/style-analysis';
import { buildMonthlySynthesisPrompt, buildAnnualSynthesisPrompt } from './prompts';

const SYNTHESIS_DELAY_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function prevMonthStr(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1); // month is 1-indexed, Date month is 0-indexed
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { from, to: nextMonth };
}

export async function runDailyCycle(): Promise<void> {
  const lastRun = getLastDailyRun() ?? new Date(0).toISOString();
  accumulatePendingSignals(lastRun);
  setLastDailyRun(new Date().toISOString());
  console.log('[style-cycle] Daily cycle done — signals accumulated since', lastRun);
}

export async function runMonthlySynthesis(month: string): Promise<void> {
  console.log('[style-cycle] Starting monthly synthesis for', month);
  const { from, to } = monthRange(month);

  const summary = getStyleSignalsByPeriod({ from, to });
  if (summary.photoCount === 0) {
    console.log('[style-cycle] No photos for', month, '— skipping');
    return;
  }

  const prevMonth = prevMonthStr(month);
  const prevProfile = getStyleProfile(prevMonth);

  const prompt = buildMonthlySynthesisPrompt(month, summary, prevProfile?.profileText ?? null);

  let raw: string;
  try {
    raw = await callOllama(prompt, 60_000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[style-cycle] Ollama failed for monthly synthesis', month, ':', msg);
    return;
  }

  let parsed: { narrative: string; highlights: string[]; trend: string };
  try {
    parsed = extractJsonObject(raw) as typeof parsed;
    if (!parsed?.narrative) throw new Error('missing narrative');
  } catch {
    console.error('[style-cycle] Failed to parse Ollama response for', month);
    return;
  }

  // Consume pending signals buffer for this month
  consumePendingSignalsForMonth(month);

  upsertStyleProfile({
    period: month,
    type: 'monthly',
    profileText: parsed.narrative,
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    trend: parsed.trend ?? null,
    periodSummary: summary,
  });

  console.log('[style-cycle] Monthly profile saved for', month);
}

export async function runAnnualSynthesis(year: number): Promise<void> {
  console.log('[style-cycle] Starting annual synthesis for', year);
  const monthlyProfiles = getLatestProfiles(12, 'monthly')
    .filter(p => p.period.startsWith(String(year)));

  if (monthlyProfiles.length === 0) {
    console.log('[style-cycle] No monthly profiles for', year, '— skipping');
    return;
  }

  const narratives = monthlyProfiles.map(p => p.profileText);
  const prompt = buildAnnualSynthesisPrompt(year, narratives);

  let raw: string;
  try {
    raw = await callOllama(prompt, 120_000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[style-cycle] Ollama failed for annual synthesis', year, ':', msg);
    return;
  }

  let parsed: { narrative: string; highlights: string[]; trend: string };
  try {
    parsed = extractJsonObject(raw) as typeof parsed;
    if (!parsed?.narrative) throw new Error('missing narrative');
  } catch {
    console.error('[style-cycle] Failed to parse Ollama response for year', year);
    return;
  }

  upsertStyleProfile({
    period: String(year),
    type: 'annual_historical',
    profileText: parsed.narrative,
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    trend: parsed.trend ?? null,
    periodSummary: null,
  });

  console.log('[style-cycle] Annual profile saved for', year);
}

export async function runMissedMonthlySyntheses(): Promise<void> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Check last 24 months for missing profiles
  for (let i = 1; i <= 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (month >= currentMonth) continue;
    const existing = getStyleProfile(month);
    if (!existing) {
      await runMonthlySynthesis(month);
      await sleep(SYNTHESIS_DELAY_MS);
    }
  }
}
