'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { IconMenu, IconHeartbeat, IconRefresh } from '@/components/Icons';
import { useHeaderSlot } from '@/components/HeaderSlot';
import type { Theme } from '@/lib/types';
import type { HealthMetrics, MetricStatus } from '@/lib/queries/health';
import type { CatalogRow } from '@/lib/queries/catalogs';

interface Props {
  initialScore: number;
  initialMetrics: HealthMetrics;
  initialHistory: { date: string; score: number }[];
  themes: Theme[];
  projects: { id: number; title: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs?: CatalogRow[];
  activeCatalogId?: number;
}

const STATUS_COLOR: Record<MetricStatus, string> = {
  green: '#27ae60',
  amber: '#e67e22',
  red:   '#e74c3c',
  na:    'var(--text-tertiary)',
};

const STATUS_BG: Record<MetricStatus, string> = {
  green: '#f0faf4',
  amber: '#fff8f0',
  red:   '#fdf2f2',
  na:    'var(--bg-secondary)',
};

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 90 ? STATUS_COLOR.green : score >= 50 ? STATUS_COLOR.amber : STATUS_COLOR.red;

  return (
    <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
      <svg width={130} height={130} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={65} cy={65} r={r} fill="none" stroke="var(--bg-secondary)" strokeWidth={10} />
        <circle
          cx={65} cy={65} r={r} fill="none"
          stroke={color} strokeWidth={10}
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: -2, color }}>{score}</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: -2 }}>/ 100</span>
      </div>
    </div>
  );
}

function TrendChart({ history }: { history: { date: string; score: number }[] }) {
  if (history.length < 2) {
    return <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Sin historial suficiente</span>;
  }

  const W = 260, H = 60, pad = 6;
  const scores = history.map(h => h.score);
  const min = Math.max(0, Math.min(...scores) - 5);
  const max = Math.min(100, Math.max(...scores) + 5);

  const pts = history.map((h, i) => {
    const x = pad + (i / (history.length - 1)) * (W - pad * 2);
    const y = H - pad - ((h.score - min) / (max - min)) * (H - pad * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${pts.join(' L ')}`;
  const areaD = `M ${pts[0]} L ${pts.join(' L ')} L ${W - pad},${H - pad} L ${pad},${H - pad} Z`;

  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.18} />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#trendGrad)" />
      <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MetricCard({
  title,
  valueLabel,
  pct,
  st,
  actionLabel,
  actionHref,
  actionOnClick,
}: {
  title: string;
  valueLabel: string;
  pct: number | null;
  st: MetricStatus;
  actionLabel: string;
  actionHref?: string;
  actionOnClick?: () => void;
}) {
  return (
    <div style={{
      background: STATUS_BG[st],
      border: `1px solid ${STATUS_COLOR[st]}33`,
      borderRadius: 'var(--radius)',
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </span>
        <span style={{
          width: 10, height: 10, borderRadius: '50%',
          background: STATUS_COLOR[st], flexShrink: 0,
        }} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{valueLabel}</div>
      {pct !== null && (
        <div>
          <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: STATUS_COLOR[st],
              borderRadius: 3, transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, textAlign: 'right' }}>{pct}%</div>
        </div>
      )}
      {actionHref ? (
        <Link
          href={actionHref}
          style={{
            fontSize: 12, color: STATUS_COLOR[st], fontWeight: 500,
            textDecoration: 'none', marginTop: 2,
          }}
        >
          {actionLabel} →
        </Link>
      ) : (
        <button
          onClick={actionOnClick}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 12, color: STATUS_COLOR[st], fontWeight: 500,
            textAlign: 'left', marginTop: 2,
          }}
        >
          {actionLabel} →
        </button>
      )}
    </div>
  );
}

function fmtNum(n: number) { return n.toLocaleString('es'); }

export default function HealthClient({
  initialScore,
  initialMetrics,
  initialHistory,
  themes,
  projects,
  totalPhotos,
  favoriteCount,
  untaggedCount,
  catalogs = [],
  activeCatalogId = 1,
}: Props) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [score, setScore] = useState(initialScore);
  const [metrics, setMetrics] = useState<HealthMetrics>(initialMetrics);
  const [history, setHistory] = useState(initialHistory);
  const [refreshing, setRefreshing] = useState(false);
  const [computedAt, setComputedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [hRes, histRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/health/history'),
      ]);
      if (hRes.ok) {
        const data = await hRes.json();
        setScore(data.score);
        setMetrics(data.metrics);
        setComputedAt(data.computed_at);
      }
      if (histRes.ok) setHistory(await histRes.json());
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Score delta vs yesterday
  const yesterday = history.length >= 2 ? history[history.length - 2]?.score : null;
  const delta = yesterday != null ? score - yesterday : null;

  // Top 3 actions (lowest score dimensions)
  const actions = useMemo(() => {
    const m = metrics;
    const list = [
      {
        key: 'classification',
        label: `${fmtNum(m.classification.total - m.classification.value)} fotos sin clasificar`,
        impact: Math.round(((100 - m.classification.pct) / 100) * 30),
        href: '/library?tag=untagged',
        cta: 'Clasificar fotos',
        st: m.classification.status,
      },
      {
        key: 'gps',
        label: `${fmtNum(m.gps.total - m.gps.value)} fotos sin GPS`,
        impact: Math.round(((100 - m.gps.pct) / 100) * 15),
        href: '/library',
        cta: 'Ver fotos sin GPS',
        st: m.gps.status,
      },
      {
        key: 'tags_review',
        label: `${fmtNum(m.tags_review.pending)} fotos con tags sin revisar`,
        impact: Math.round((m.tags_review.pending / Math.max(m.classification.total, 1)) * 10),
        href: '/library',
        cta: 'Revisar tags',
        st: m.tags_review.status,
      },
      {
        key: 'integrity',
        label: `${m.integrity.orphans} archivo(s) huérfano(s) detectados`,
        impact: m.integrity.orphans > 0 ? 10 : 0,
        href: '/tools/integrity',
        cta: 'Verificar integridad',
        st: m.integrity.status,
      },
    ];
    return list.filter(a => a.impact > 0).sort((a, b) => b.impact - a.impact).slice(0, 3);
  }, [metrics]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useHeaderSlot(useMemo(() => (
    <div className="header-slot-library">
      <button className="hamburger header-slot-hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
        <IconMenu size={20} />
      </button>
      <span className="header-slot-title">Salud de la biblioteca</span>
      <div className="topbar-spacer" />
      <button
        className="btn-small"
        onClick={refresh}
        disabled={refreshing}
        style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}
      >
        {refreshing ? <span className="spinner dark" aria-hidden /> : <IconRefresh size={12} />}
        Actualizar
      </button>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [refreshing]));

  const m = metrics;

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
        catalogs={catalogs}
        activeCatalogId={activeCatalogId}
      />

      <div className="main">
        <div className="content" style={{ maxWidth: 860 }}>

          {/* Score hero */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '24px 28px',
            display: 'flex', alignItems: 'center', gap: 28, marginBottom: 24,
          }}>
            <ScoreRing score={score} />
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Score de salud</h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Media ponderada de 6 dimensiones de tu biblioteca.
              </p>
              {delta !== null && (
                <span style={{ fontSize: 13, fontWeight: 600, color: delta >= 0 ? STATUS_COLOR.green : STATUS_COLOR.red }}>
                  {delta >= 0 ? `↑ +${delta}` : `↓ ${delta}`} pts respecto a ayer
                </span>
              )}
              {computedAt && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Actualizado: {new Date(computedAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              )}
            </div>
            {/* Trend chart */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Últimos 30 días</span>
              <TrendChart history={history} />
            </div>
          </div>

          {/* Metrics grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 14, marginBottom: 24,
          }}>
            <MetricCard
              title="Clasificación IA"
              valueLabel={`${fmtNum(m.classification.value)} de ${fmtNum(m.classification.total)} fotos clasificadas`}
              pct={m.classification.pct}
              st={m.classification.status}
              actionLabel="Clasificar fotos"
              actionHref="/library"
            />
            <MetricCard
              title="Cobertura GPS"
              valueLabel={`${fmtNum(m.gps.value)} de ${fmtNum(m.gps.total)} fotos con coordenadas`}
              pct={m.gps.pct}
              st={m.gps.status}
              actionLabel="Ver sin GPS"
              actionHref="/library"
            />
            <MetricCard
              title="Tags pendientes de revisión"
              valueLabel={m.tags_review.pending === 0
                ? 'Todos los tags revisados'
                : `${fmtNum(m.tags_review.pending)} fotos con solo tags IA`}
              pct={null}
              st={m.tags_review.status}
              actionLabel="Revisar tags"
              actionHref="/library"
            />
            <MetricCard
              title="Integridad"
              valueLabel={m.integrity.orphans === 0
                ? 'Sin archivos huérfanos'
                : `${m.integrity.orphans} archivo(s) huérfano(s)`}
              pct={null}
              st={m.integrity.status}
              actionLabel="Verificar integridad"
              actionHref="/tools/integrity"
            />
            <MetricCard
              title="Duplicados"
              valueLabel={m.duplicates.groups === 0 ? 'Sin duplicados detectados' : `${m.duplicates.groups} grupos`}
              pct={null}
              st={m.duplicates.status}
              actionLabel="Ver duplicados"
              actionHref="/library"
            />
            <MetricCard
              title="Pares RAW+JPEG"
              valueLabel={m.raw_pairs.pairs === 0 ? 'Sin pares detectados' : `${m.raw_pairs.pairs} pares`}
              pct={null}
              st={m.raw_pairs.status}
              actionLabel="Ver pares"
              actionHref="/library"
            />
          </div>

          {/* Actions */}
          {actions.length > 0 && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '20px 24px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: 'var(--text)' }}>
                Por hacer — las acciones que más mejorarían tu score
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {actions.map(a => (
                  <div key={a.key} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                    background: STATUS_BG[a.st], border: `1px solid ${STATUS_COLOR[a.st]}22`,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[a.st], flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{a.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      +{a.impact} pts estimados
                    </span>
                    <Link
                      href={a.href}
                      style={{
                        fontSize: 12, color: STATUS_COLOR[a.st], fontWeight: 600,
                        textDecoration: 'none', flexShrink: 0,
                        padding: '4px 10px', border: `1px solid ${STATUS_COLOR[a.st]}`,
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {a.cta}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {actions.length === 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '16px 20px', background: '#f0faf4',
              border: '1px solid #a8e6c0', borderRadius: 'var(--radius)',
              color: '#1a7a40', fontSize: 13,
            }}>
              <HeartbeatIcon />
              Tu biblioteca está en excelente forma. No hay acciones prioritarias pendientes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeartbeatIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
