import type { StyleProfile } from '@/lib/types';

export default function HistoryBlock({ profiles }: { profiles: StyleProfile[] }) {
  if (profiles.length === 0) {
    return (
      <div className="insights-block">
        <h2 className="insights-block-title">Tu historia fotográfica</h2>
        <p className="insights-placeholder">Tu historia fotográfica estará disponible cuando completemos el análisis de tu catálogo histórico.</p>
      </div>
    );
  }

  return (
    <div className="insights-block">
      <h2 className="insights-block-title">Tu historia fotográfica</h2>
      <div className="insights-history-list">
        {profiles.map(p => (
          <div key={p.period} className="insights-year">
            <div className="insights-year-header">{p.period}</div>
            {p.profileText
              ? <div className="insights-narrative">{p.profileText}</div>
              : <div className="insights-narrative-pending">Narrativa en cola — se generará cuando Ollama esté disponible.</div>
            }
            {p.highlights.length > 0 && (
              <ul className="insights-year-highlights">
                {p.highlights.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            )}
            {p.trend && <div className="insights-trend insights-trend--year">{p.trend}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
