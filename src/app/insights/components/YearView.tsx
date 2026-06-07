import type { YearData } from '@/app/api/insights/years/route';
import StatsBlock from './StatsBlock';

export default function YearView({ data }: { data: YearData }) {
  return (
    <div className="insights-year-view">
      <div className="insights-year-view-header">
        <h2 className="insights-year-title">{data.year}</h2>
        {data.isCurrent && <span className="insights-year-badge">Este año</span>}
      </div>

      {data.narrative ? (
        <div className="insights-year-narrative">{data.narrative}</div>
      ) : (
        <div className="insights-narrative-pending">
          Narrativa en cola — se generará cuando Ollama esté disponible.
        </div>
      )}

      <StatsBlock stats={data.stats} photoCount={data.photoCount} />

      {data.trend && (
        <div className="insights-year-trend">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
          </svg>
          {data.trend}
        </div>
      )}
    </div>
  );
}
