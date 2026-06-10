'use client';

interface Series {
  label: string;
  color: string;
  data: { x: number; y: number }[];
}

interface LineChartProps {
  series: Series[];
  years: number[];
  formatY?: (v: number) => string;
  title: string;
}

const COLORS = [
  '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6b7280',
];

export { COLORS };

const W = 560;
const H = 180;
const PAD = { top: 12, right: 16, bottom: 28, left: 40 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

export default function LineChart({ series, years, formatY, title }: LineChartProps) {
  if (years.length === 0 || series.every(s => s.data.length === 0)) {
    return (
      <div className="evolution-chart-empty">
        <span>{title}</span>
        <p>Sin datos suficientes</p>
      </div>
    );
  }

  // Compute scales
  const allY = series.flatMap(s => s.data.map(d => d.y));
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const yRange = maxY - minY || 1;

  const minX = years[0];
  const maxX = years[years.length - 1];
  const xRange = maxX - minX || 1;

  function scaleX(x: number) {
    return PAD.left + ((x - minX) / xRange) * INNER_W;
  }
  function scaleY(y: number) {
    return PAD.top + INNER_H - ((y - minY) / yRange) * INNER_H;
  }

  // Y axis ticks (3-4 ticks)
  const yTicks: number[] = [];
  const tickCount = 3;
  for (let i = 0; i <= tickCount; i++) {
    yTicks.push(minY + (yRange * i) / tickCount);
  }

  // X axis: show year labels, skip if too many
  const step = years.length > 12 ? Math.ceil(years.length / 8) : 1;
  const xLabels = years.filter((_, i) => i % step === 0 || i === years.length - 1);

  return (
    <div className="evolution-chart">
      <h3 className="evolution-chart-title">{title}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="evolution-chart-svg">
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <line
            key={i}
            x1={PAD.left} y1={scaleY(t)}
            x2={W - PAD.right} y2={scaleY(t)}
            stroke="var(--border)" strokeWidth="1" strokeDasharray="3,3"
          />
        ))}

        {/* Y axis labels */}
        {yTicks.map((t, i) => (
          <text
            key={i}
            x={PAD.left - 5} y={scaleY(t) + 4}
            textAnchor="end" fontSize="10" fill="var(--text-muted)"
          >
            {formatY ? formatY(t) : Math.round(t)}
          </text>
        ))}

        {/* X axis labels */}
        {xLabels.map(y => (
          <text
            key={y}
            x={scaleX(y)} y={H - 6}
            textAnchor="middle" fontSize="10" fill="var(--text-muted)"
          >
            {y}
          </text>
        ))}

        {/* Lines */}
        {series.map(s => {
          if (s.data.length < 2) {
            // Single point — draw a dot
            const pt = s.data[0];
            if (!pt) return null;
            return (
              <circle
                key={s.label}
                cx={scaleX(pt.x)} cy={scaleY(pt.y)}
                r={3} fill={s.color}
              />
            );
          }
          const points = s.data.map(d => `${scaleX(d.x)},${scaleY(d.y)}`).join(' ');
          return (
            <g key={s.label}>
              <polyline
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.data.map((d, i) => (
                <circle key={i} cx={scaleX(d.x)} cy={scaleY(d.y)} r={2.5} fill={s.color} />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      {series.length > 1 && (
        <div className="evolution-chart-legend">
          {series.map(s => (
            <span key={s.label} className="evolution-chart-legend-item">
              <span className="evolution-chart-legend-dot" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
