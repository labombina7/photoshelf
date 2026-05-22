'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { IconMenu } from '@/components/Icons';
import type { Theme } from '@/lib/types';
import type { StatsData } from './page';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fmtBytes(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB';
  return (bytes / 1e3).toFixed(0) + ' KB';
}

function fmtNum(n: number): string {
  return n.toLocaleString('es');
}

function BarChart({ data }: { data: { year: number; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const router = useRouter();
  const BAR_H = 100;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, overflowX: 'auto', paddingBottom: 4 }}>
      {data.map(d => {
        const h = Math.max(4, Math.round((d.count / max) * BAR_H));
        return (
          <button
            key={d.year}
            className="stats-year-btn"
            onClick={() => router.push(`/library?year=${d.year}`)}
            title={`${d.year}: ${fmtNum(d.count)} fotos`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 28 }}
          >
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{fmtNum(d.count)}</div>
            <div
              style={{
                width: '100%', height: h,
                background: 'var(--text)', borderRadius: '3px 3px 0 0',
                opacity: 0.75, transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.75')}
            />
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 28 }}>
              {d.year}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MonthChart({ data }: { data: { month: number; count: number }[] }) {
  const byMonth = Object.fromEntries(data.map(d => [d.month, d.count]));
  const max = Math.max(...Object.values(byMonth), 1);

  return (
    <div className="stats-month-grid">
      {MONTHS.map((label, i) => {
        const count = byMonth[i + 1] ?? 0;
        const pct = Math.round((count / max) * 100);
        return (
          <div key={i} className="stats-month-cell" title={`${label}: ${fmtNum(count)} fotos`}>
            <div className="stats-month-bar">
              <div className="stats-month-fill" style={{ height: `${pct}%` }} />
            </div>
            <div className="stats-month-label">{label}</div>
            {count > 0 && <div className="stats-month-count">{count}</div>}
          </div>
        );
      })}
    </div>
  );
}

function HourChart({ data }: { data: { hour: number; count: number }[] }) {
  const byHour = Object.fromEntries(data.map(d => [d.hour, d.count]));
  const max = Math.max(...Object.values(byHour), 1);
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div>
      <div className="stats-hour-grid">
        {Array.from({ length: 24 }, (_, h) => {
          const count = byHour[h] ?? 0;
          const pct = Math.max(2, Math.round((count / max) * 100));
          return (
            <div
              key={h}
              className="stats-hour-bar"
              style={{ height: `${pct}%`, opacity: hovered === h ? 1 : 0.65 }}
              onMouseEnter={() => setHovered(h)}
              onMouseLeave={() => setHovered(null)}
              title={`${String(h).padStart(2, '0')}:00 — ${fmtNum(count)} fotos`}
            />
          );
        })}
      </div>
      <div className="stats-hour-labels">
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="stats-hour-label">
            {h % 6 === 0 ? `${h}h` : ''}
          </div>
        ))}
      </div>
      {hovered !== null && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          {String(hovered).padStart(2, '0')}:00 — {fmtNum(byHour[hovered] ?? 0)} fotos
        </div>
      )}
    </div>
  );
}

function CameraChart({ cameras }: { cameras: { camera: string; count: number }[] }) {
  const max = Math.max(...cameras.map(c => c.count), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {cameras.map(c => (
        <div key={c.camera} className="stats-bar-row">
          <div className="stats-bar-label" title={c.camera}>{c.camera}</div>
          <div className="stats-bar-track">
            <div className="stats-bar-fill" style={{ width: `${(c.count / max) * 100}%` }} />
          </div>
          <div className="stats-bar-count">{fmtNum(c.count)}</div>
        </div>
      ))}
    </div>
  );
}

function TagsList({ tags }: { tags: StatsData['tags'] }) {
  return (
    <div className="stats-tags-grid">
      {tags.map(t => {
        const source = t.aiCount > 0 && t.manualCount > 0
          ? 'mixed'
          : t.aiCount > 0 ? 'ai' : 'manual';
        const sourceLabel = source === 'ai' ? 'IA' : source === 'manual' ? 'manual' : 'mixto';
        return (
          <div key={t.name} className="stats-tag-row">
            <div className="stats-tag-name" title={t.name}>{t.name}</div>
            <span className={`stats-tag-source stats-tag-source--${source}`}>{sourceLabel}</span>
            <div className="stats-tag-count">{fmtNum(t.total)}</div>
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  stats: StatsData;
  themes: Theme[];
  projects: { id: number; title: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
}

export default function StatsClient({ stats, themes, projects, totalPhotos, favoriteCount, untaggedCount }: Props) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const router = useRouter();
  const { overview, byYear, byMonth, selectedYear, cameras, tags, byHour } = stats;

  const yearRange = overview.minYear && overview.maxYear
    ? overview.minYear === overview.maxYear
      ? String(overview.minYear)
      : `${overview.minYear} – ${overview.maxYear}`
    : '—';

  const availableYears = byYear.map(y => y.year);

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes}
        projects={projects}
        totalPhotos={totalPhotos}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <div className="main">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
              <IconMenu size={20} />
            </button>
            <div className="topbar-title">Estadísticas</div>
          </div>
          <div className="topbar-spacer" />
          <button
            className="btn-small"
            style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            onClick={() => router.refresh()}
          >
            Actualizar
          </button>
        </div>

        <div className="content">
          {/* Overview cards */}
          <div className="stats-section">
            <div className="stats-section-title">Resumen</div>
            <div className="stats-grid">
              <div className="stats-card">
                <div className="stats-card-value">{fmtNum(overview.total)}</div>
                <div className="stats-card-label">Fotos</div>
              </div>
              <div className="stats-card">
                <div className="stats-card-value">{fmtBytes(overview.sizeBytes)}</div>
                <div className="stats-card-label">Espacio total</div>
              </div>
              <div className="stats-card">
                <div className="stats-card-value">{yearRange}</div>
                <div className="stats-card-label">Años cubiertos</div>
              </div>
              <div className="stats-card">
                <div className="stats-card-value">{fmtNum(overview.eventCount)}</div>
                <div className="stats-card-label">Eventos</div>
              </div>
              <div className="stats-card">
                <div className="stats-card-value">{fmtNum(overview.tagCount)}</div>
                <div className="stats-card-label">Tags únicos</div>
              </div>
              <div className="stats-card">
                <div className="stats-card-value">{fmtNum(overview.favorites)}</div>
                <div className="stats-card-label">Favoritos</div>
              </div>
              <div className="stats-card">
                <div className="stats-card-value">{fmtNum(overview.withGps)}</div>
                <div className="stats-card-label">Con GPS</div>
              </div>
              <div className="stats-card">
                <div className="stats-card-value">{fmtNum(overview.themeCount)}</div>
                <div className="stats-card-label">Temáticas</div>
              </div>
            </div>
          </div>

          {/* Photos by year */}
          {byYear.length > 0 && (
            <div className="stats-section">
              <div className="stats-section-title">Fotos por año</div>
              <div className="stats-chart-wrap">
                <BarChart data={byYear} />
              </div>
            </div>
          )}

          <div className="stats-two-col">
            {/* Activity by month */}
            <div className="stats-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div className="stats-section-title" style={{ margin: 0 }}>Actividad mensual</div>
                <select
                  className="stats-year-select"
                  value={selectedYear}
                  onChange={e => router.push(`/stats?year=${e.target.value}`)}
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="stats-chart-wrap">
                {byMonth.length > 0 ? (
                  <MonthChart data={byMonth} />
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>
                    Sin datos de fecha para {selectedYear}
                  </div>
                )}
              </div>
            </div>

            {/* Cameras */}
            {cameras.length > 0 && (
              <div className="stats-section">
                <div className="stats-section-title">Cámaras más usadas</div>
                <div className="stats-chart-wrap">
                  <CameraChart cameras={cameras} />
                </div>
              </div>
            )}
          </div>

          <div className="stats-two-col">
            {/* Hour distribution */}
            {byHour.length > 0 && (
              <div className="stats-section">
                <div className="stats-section-title">Hora del día</div>
                <div className="stats-chart-wrap">
                  <HourChart data={byHour} />
                </div>
              </div>
            )}

            {/* Top tags */}
            {tags.length > 0 && (
              <div className="stats-section">
                <div className="stats-section-title">Tags más frecuentes</div>
                <div className="stats-chart-wrap">
                  <TagsList tags={tags} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
