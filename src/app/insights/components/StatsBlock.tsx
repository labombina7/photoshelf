import type { YearData } from '@/app/api/insights/years/route';

function hourLabel(avg: number): string {
  if (avg < 6) return 'Madrugada (0–6h)';
  if (avg < 12) return `Mañanas (${Math.floor(avg)}h)`;
  if (avg < 16) return `Mediodía (${Math.floor(avg)}h)`;
  if (avg < 20) return `Tardes (${Math.floor(avg)}h)`;
  return `Noches (${Math.floor(avg)}h)`;
}

export default function StatsBlock({ stats, photoCount }: { stats: YearData['stats']; photoCount: number }) {
  const rows: { icon: string; label: string; value: string }[] = [];

  if (stats.topCamera) rows.push({ icon: '📷', label: 'Cámara', value: stats.topCamera });
  if (stats.topFocalLengths.length) rows.push({ icon: '🔭', label: 'Focal', value: stats.topFocalLengths.map(f => `${f}mm`).join(' · ') });
  if (stats.topApertures.length) rows.push({ icon: '⚡', label: 'Apertura', value: stats.topApertures.map(a => `f/${a}`).join(' · ') });
  if (stats.topIsos.length) rows.push({ icon: '💡', label: 'ISO', value: stats.topIsos.join(' · ') });
  if (stats.avgHourOfDay !== null) rows.push({ icon: '🕐', label: 'Horario', value: hourLabel(stats.avgHourOfDay) });
  if (stats.topGenres.length) rows.push({ icon: '🎨', label: 'Géneros', value: stats.topGenres.join(' · ') });
  rows.push({ icon: '📸', label: 'Fotos', value: photoCount.toLocaleString('es-ES') });

  if (rows.length === 1) return null; // only photo count, no EXIF data

  return (
    <div className="insights-stats-block">
      {rows.map(r => (
        <div key={r.label} className="insights-stats-row">
          <span className="insights-stats-icon">{r.icon}</span>
          <span className="insights-stats-label">{r.label}</span>
          <span className="insights-stats-value">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
