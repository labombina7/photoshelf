'use client';

import type { BootstrapProgress } from '@/lib/types';

export default function BootstrapProgressBar({ progress }: { progress: BootstrapProgress }) {
  if (progress.percent >= 100) return null;

  return (
    <div className="insights-bootstrap-notice">
      <div className="insights-bootstrap-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <div className="insights-bootstrap-text">
        <strong>Analizando tu catálogo</strong>
        <span>
          {progress.total === 0
            ? 'Preparando el análisis…'
            : `${progress.done} de ${progress.total} periodos procesados (${progress.percent}%). Los insights estarán disponibles en breve.`}
        </span>
      </div>
      {progress.total > 0 && (
        <div className="insights-bootstrap-bar" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="insights-bootstrap-fill" style={{ width: `${progress.percent}%` }} />
        </div>
      )}
    </div>
  );
}
