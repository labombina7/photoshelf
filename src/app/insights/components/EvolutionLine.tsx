import type { YearData } from '@/app/api/insights/years/route';

export default function EvolutionLine({
  years,
  currentIndex,
  onSelect,
}: {
  years: YearData[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  if (years.length <= 1) return null;

  return (
    <div className="insights-evolution">
      <h3 className="insights-evolution-title">Tu evolución</h3>
      <div className="insights-evolution-track">
        {[...years].reverse().map((y, reversedIdx) => {
          const idx = years.length - 1 - reversedIdx;
          const isActive = idx === currentIndex;
          return (
            <button
              key={y.year}
              className={`insights-evolution-pill${isActive ? ' active' : ''}`}
              onClick={() => onSelect(idx)}
            >
              <span className="insights-evolution-year">{y.year}</span>
              <span className="insights-evolution-count">{y.photoCount.toLocaleString('es-ES')} fotos</span>
              {y.trend && (
                <span className="insights-evolution-trend">{y.trend}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
