import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { getLatestProfiles } from '@/lib/queries/style-analysis';
import { mobileCameraExclusionSQL, mobileCameraExclusionParams } from '@/lib/config';
import type { StyleProfile, PeriodStyleSummary } from '@/lib/types';

export interface YearData {
  year: number;
  isCurrent: boolean;
  photoCount: number;
  narrative: string | null;
  highlights: string[];
  trend: string | null;
  stats: {
    topCamera: string | null;
    topFocalLengths: number[];
    topApertures: number[];
    topIsos: number[];
    avgHourOfDay: number | null;
    topGenres: string[];
  };
}

function topN<T>(values: T[], n: number): T[] {
  const counts = new Map<string, { val: T; n: number }>();
  for (const v of values) {
    const key = String(v);
    const entry = counts.get(key);
    if (entry) entry.n++;
    else counts.set(key, { val: v, n: 1 });
  }
  return Array.from(counts.values())
    .sort((a, b) => b.n - a.n)
    .slice(0, n)
    .map(e => e.val);
}

function aggregateMonthlyStats(profiles: StyleProfile[]): YearData['stats'] & { photoCount: number } {
  const summaries = profiles.map(p => p.periodSummary).filter(Boolean) as PeriodStyleSummary[];

  const cameras = summaries.map(s => s.topCamera).filter(Boolean) as string[];
  const focals = summaries.flatMap(s => s.topFocalLengths ?? []);
  const apertures = summaries.flatMap(s => s.topApertures ?? []);
  const isos = summaries.flatMap(s => s.topIsos ?? []);
  const hours = summaries.map(s => s.avgHourOfDay).filter(v => v !== null) as number[];
  const genres = summaries.flatMap(s => s.topGenres ?? []);
  const photoCount = summaries.reduce((sum, s) => sum + (s.photoCount ?? 0), 0);

  return {
    photoCount,
    topCamera: topN(cameras, 1)[0] ?? null,
    topFocalLengths: topN(focals, 3),
    topApertures: topN(apertures, 3),
    topIsos: topN(isos, 3),
    avgHourOfDay: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
    topGenres: topN(genres, 3),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getDb();
    const currentYear = new Date().getFullYear();

    // All years that have photos (mobile excluded)
    const mobSql = mobileCameraExclusionSQL('');
    const mobParams = mobileCameraExclusionParams();
    const yearsWithPhotos = (db.prepare(`
      SELECT CAST(strftime('%Y', taken_at) AS INTEGER) AS year, COUNT(*) AS photo_count
      FROM photos WHERE taken_at IS NOT NULL AND ${mobSql}
      GROUP BY year ORDER BY year DESC
    `).all(...mobParams) as { year: number; photo_count: number }[]);

    if (yearsWithPhotos.length === 0) {
      return NextResponse.json([]);
    }

    // Annual profiles (historical)
    const annualProfiles = getLatestProfiles(50, 'annual_historical');
    const annualByYear = new Map(annualProfiles.map(p => [Number(p.period), p]));

    // Monthly profiles (recent years)
    const monthlyProfiles = getLatestProfiles(60, 'monthly');
    const monthlyByYear = new Map<number, StyleProfile[]>();
    for (const p of monthlyProfiles) {
      const yr = Number(p.period.substring(0, 4));
      if (!monthlyByYear.has(yr)) monthlyByYear.set(yr, []);
      monthlyByYear.get(yr)!.push(p);
    }

    const result: YearData[] = yearsWithPhotos.map(({ year, photo_count }) => {
      const annual = annualByYear.get(year);
      const monthly = monthlyByYear.get(year) ?? [];

      if (annual) {
        // Use annual profile directly
        return {
          year,
          isCurrent: year === currentYear,
          photoCount: annual.periodSummary?.photoCount ?? photo_count,
          narrative: annual.profileText,
          highlights: annual.highlights,
          trend: annual.trend,
          stats: {
            topCamera: annual.periodSummary?.topCamera ?? null,
            topFocalLengths: annual.periodSummary?.topFocalLengths ?? [],
            topApertures: annual.periodSummary?.topApertures ?? [],
            topIsos: annual.periodSummary?.topIsos ?? [],
            avgHourOfDay: annual.periodSummary?.avgHourOfDay ?? null,
            topGenres: annual.periodSummary?.topGenres ?? [],
          },
        };
      }

      // Aggregate from monthly profiles
      const agg = aggregateMonthlyStats(monthly);
      const withNarrative = [...monthly].sort((a, b) => b.period.localeCompare(a.period)).find(p => p.profileText);
      const withTrend = [...monthly].sort((a, b) => b.period.localeCompare(a.period)).find(p => p.trend);

      return {
        year,
        isCurrent: year === currentYear,
        photoCount: agg.photoCount || photo_count,
        narrative: withNarrative?.profileText ?? null,
        highlights: withNarrative?.highlights ?? [],
        trend: withTrend?.trend ?? null,
        stats: {
          topCamera: agg.topCamera,
          topFocalLengths: agg.topFocalLengths,
          topApertures: agg.topApertures,
          topIsos: agg.topIsos,
          avgHourOfDay: agg.avgHourOfDay,
          topGenres: agg.topGenres,
        },
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/insights/years] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
