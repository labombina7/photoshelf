'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AlbumCluster } from '@/lib/albumClusterizer';

interface Props {
  catalogId: number;
  catalogName: string;
  clusters: AlbumCluster[];
  alreadyOrganized: boolean;
  otherCatalogsExist: boolean;
}

function formatDateRange(from: string, to: string): string {
  const f = new Date(from + 'T12:00:00Z');
  const t = new Date(to + 'T12:00:00Z');
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  if (from === to) return f.toLocaleDateString('es', opts);
  if (f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear()) {
    return `${f.getDate()}–${t.getDate()} ${f.toLocaleDateString('es', { month: 'short' })} ${f.getFullYear()}`;
  }
  return `${f.toLocaleDateString('es', opts)} – ${t.toLocaleDateString('es', opts)}`;
}

export default function OrganizeClient({ catalogId, catalogName, clusters: initialClusters, alreadyOrganized, otherCatalogsExist }: Props) {
  const router = useRouter();
  const [clusters, setClusters] = useState(initialClusters.map((c, i) => ({ ...c, key: i, enabled: true })));
  const [saving, setSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [loadingClusters, setLoadingClusters] = useState(false);
  const [crossCatalog, setCrossCatalog] = useState(otherCatalogsExist);
  const [error, setError] = useState('');

  async function handleCrossCatalogChange(value: boolean) {
    setCrossCatalog(value);
    setLoadingClusters(true);
    setError('');
    try {
      const res = await fetch(`/api/catalogs/${catalogId}/suggest-albums?crossCatalog=${value}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json() as { clusters: AlbumCluster[] };
      setClusters(data.clusters.map((c, i) => ({ ...c, key: i, enabled: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar sugerencias');
    } finally {
      setLoadingClusters(false);
    }
  }

  const enabledCount = clusters.filter(c => c.enabled).length;
  const totalPhotos = clusters.filter(c => c.enabled).reduce((s, c) => s + c.photoCount, 0);

  function updateName(key: number, name: string) {
    setClusters(prev => prev.map(c => c.key === key ? { ...c, name } : c));
  }

  function toggleEnabled(key: number) {
    setClusters(prev => prev.map(c => c.key === key ? { ...c, enabled: !c.enabled } : c));
  }

  async function handleConfirm() {
    const albums = clusters.filter(c => c.enabled && c.name.trim());
    if (albums.length === 0) { setError('Selecciona al menos un álbum'); return; }

    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/catalogs/${catalogId}/auto-organize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albums: albums.map(a => ({ name: a.name, rules: a.rules })) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.push('/smart-albums');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear los álbumes');
      setSaving(false);
    }
  }

  async function handleUndo() {
    setUndoing(true);
    setError('');
    try {
      const res = await fetch(`/api/catalogs/${catalogId}/auto-organize`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      router.push('/smart-albums');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al deshacer');
      setUndoing(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '32px 24px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, padding: 0, marginBottom: 12 }}
          >
            ← Volver
          </button>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Organizar "{catalogName}"</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            {initialClusters.some(c => c.source === 'event_match')
              ? `${initialClusters.filter(c => c.source === 'event_match').length} grupos coinciden con eventos de otros catálogos${initialClusters.some(c => c.source === 'fallback') ? ` + ${initialClusters.filter(c => c.source === 'fallback').length} grupos sin coincidencia` : ''}.`
              : `Photoshelf ha detectado ${initialClusters.length} grupos de fotos por actividad.`}
            {' '}Revisa los nombres y confirma.
          </p>
        </div>

        {/* Cross-catalog option */}
        {otherCatalogsExist && (
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '12px 16px',
          }}>
            <input
              type="checkbox"
              checked={crossCatalog}
              disabled={loadingClusters}
              onChange={e => handleCrossCatalogChange(e.target.checked)}
              style={{ marginTop: 2, width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
            />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
                Buscar coincidencias en otros catálogos
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                Si tienes eventos organizados en otro catálogo, se usarán sus fechas para nombrar los álbumes automáticamente.
              </p>
            </div>
          </label>
        )}

        {/* Already organized notice */}
        {alreadyOrganized && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Este catálogo ya tiene smart albums automáticos. Puedes reemplazarlos o deshacerlos.
            </span>
            <button
              className="btn-small"
              style={{ background: 'var(--border)', color: 'var(--text)', whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={handleUndo}
              disabled={undoing}
            >
              {undoing ? 'Deshaciendo…' : 'Deshacer organización'}
            </button>
          </div>
        )}

        {/* Clusters list */}
        {loadingClusters ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            Analizando fotos…
          </div>
        ) : clusters.length === 0 ? (
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
            No hay fotos con fecha EXIF en este catálogo. Escanea primero las fotos.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clusters.map(c => (
              <div
                key={c.key}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  opacity: c.enabled ? 1 : 0.45,
                }}
              >
                <input
                  type="checkbox"
                  checked={c.enabled}
                  onChange={() => toggleEnabled(c.key)}
                  style={{ flexShrink: 0, cursor: 'pointer', width: 16, height: 16 }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <input
                    className="tag-input"
                    value={c.name}
                    disabled={!c.enabled}
                    onChange={e => updateName(c.key, e.target.value)}
                    style={{ fontSize: 14, fontWeight: 500 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {formatDateRange(c.dateFrom, c.dateTo)} · {c.photoCount.toLocaleString('es')} fotos
                    {c.source === 'event_match' && (
                      <span style={{ marginLeft: 6, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>· coincide con otro catálogo</span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p style={{ margin: 0, color: '#e74c3c', fontSize: 13 }}>{error}</p>}

        {/* Footer */}
        {clusters.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {enabledCount} álbumes · {totalPhotos.toLocaleString('es')} fotos
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-small"
                style={{ background: 'var(--border)', color: 'var(--text)' }}
                onClick={() => router.back()}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: 13 }}
                onClick={handleConfirm}
                disabled={saving || enabledCount === 0}
              >
                {saving ? 'Creando álbumes…' : `Crear ${enabledCount} smart albums`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
