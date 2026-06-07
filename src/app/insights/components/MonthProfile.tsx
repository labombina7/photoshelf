'use client';

import { useState } from 'react';
import type { StyleProfile } from '@/lib/types';

function formatMonth(period: string): string {
  const [y, m] = period.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

function ExifChips({ summary }: { summary: NonNullable<StyleProfile['periodSummary']> }) {
  const chips: string[] = [];
  if (summary.topCamera) chips.push(summary.topCamera);
  if (summary.topFocalLengths?.length) chips.push(summary.topFocalLengths.map(f => `${f}mm`).join(' · '));
  if (summary.topApertures?.length) chips.push(summary.topApertures.map(a => `f/${a}`).join(' · '));
  if (summary.topIsos?.length) chips.push(summary.topIsos.map(i => `ISO ${i}`).join(' · '));
  if (!chips.length) return null;
  return (
    <div className="insights-exif-chips">
      {chips.map(c => <span key={c} className="insights-exif-chip">{c}</span>)}
    </div>
  );
}

export default function MonthProfile({ profile, defaultOpen = false }: { profile: StyleProfile; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="insights-month">
      <button
        className={`insights-month-header${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="insights-month-title">{formatMonth(profile.period)}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`insights-chevron${open ? ' open' : ''}`} aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="insights-month-body">
          {profile.periodSummary && <ExifChips summary={profile.periodSummary} />}

          {profile.profileText
            ? <div className="insights-narrative">{profile.profileText}</div>
            : <div className="insights-narrative-pending">Narrativa en cola — se generará cuando Ollama esté disponible.</div>
          }

          {profile.highlights.length > 0 && (
            <div className="insights-highlights">
              <div className="insights-highlights-label">Destacados</div>
              <ul>
                {profile.highlights.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}

          {profile.trend && (
            <div className="insights-trend">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
              </svg>
              {profile.trend}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
