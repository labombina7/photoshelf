'use client';

import type { StyleProfile } from '@/lib/types';
import MonthProfile from './MonthProfile';

function currentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function RecentEvolutionBlock({ profiles }: { profiles: StyleProfile[] }) {
  const currentMonth = currentMonthStr();
  const hasCurrentMonth = profiles.some(p => p.period === currentMonth);

  return (
    <div className="insights-block">
      <h2 className="insights-block-title">Tu evolución reciente</h2>
      {profiles.length === 0 && (
        <p className="insights-placeholder">Los perfiles mensuales estarán disponibles una vez que el análisis del catálogo esté en marcha.</p>
      )}
      {!hasCurrentMonth && (
        <div className="insights-current-month-note">
          <span className="insights-month-in-progress">Mes en curso</span> — el perfil estará listo el próximo mes.
        </div>
      )}
      <div className="insights-months-list">
        {profiles.map((p, i) => (
          <MonthProfile key={p.period} profile={p} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}
