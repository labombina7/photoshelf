'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { IconMenu, IconMap, IconX } from '@/components/Icons';
import type { Theme } from '@/lib/types';

interface PhotoPoint {
  id: number;
  filename: string;
  taken_at: string | null;
  event: string;
  gps_lat: number;
  gps_lon: number;
}

interface Props {
  total: number;
  withGps: number;
  themes: Theme[];
  projects: { id: number; title: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  availableYears: number[];
  initialYear: number | null;
  catalogs?: import('@/lib/queries/catalogs').CatalogRow[];
  activeCatalogId?: number;
}

export default function MapClient({
  total, themes, projects, totalPhotos, favoriteCount, untaggedCount,
  availableYears, initialYear, catalogs = [], activeCatalogId = 1,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<{ map: L.Map; cluster: any; L: typeof import('leaflet') } | null>(null);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<PhotoPoint[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [loadingYear, setLoadingYear] = useState(false);
  const [activeYear, setActiveYear] = useState<number | null>(initialYear);
  const [visibleCount, setVisibleCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);

  // Load markers for a given year (or all years if null). Reuses existing map instance.
  const loadMarkers = useCallback(async (year: number | null) => {
    const ref = leafletRef.current;
    if (!ref) return;
    const { map, cluster, L } = ref;

    setLoadingYear(true);
    setPanelOpen(false);

    const url = year !== null ? `/api/photos/map?year=${year}` : '/api/photos/map';
    const res = await fetch(url);
    const data = await res.json();
    const photos: PhotoPoint[] = data.photos ?? [];

    cluster.clearLayers();

    if (photos.length === 0) {
      setVisibleCount(0);
      setLimitReached(false);
      setLoadingYear(false);
      return;
    }

    const bounds: [number, number][] = [];

    for (const photo of photos) {
      const icon = L.divIcon({
        html: `<div class="map-marker-dot"></div>`,
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([photo.gps_lat, photo.gps_lon], { icon });
      (marker as unknown as { _photoData: PhotoPoint })._photoData = photo;

      marker.on('click', () => {
        const same = photos.filter(p => p.gps_lat === photo.gps_lat && p.gps_lon === photo.gps_lon);
        setSelectedPhotos(same);
        setPanelOpen(true);
      });

      cluster.addLayer(marker);
      bounds.push([photo.gps_lat, photo.gps_lon]);
    }

    map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 14 });
    setVisibleCount(photos.length);
    setLimitReached(data.limitReached ?? false);
    setLoadingYear(false);
  }, []);

  // Initialize Leaflet once
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;
    let cancelled = false;

    async function init() {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css' as string);
      await import('leaflet.markercluster');
      await import('leaflet.markercluster/dist/MarkerCluster.css' as string);
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css' as string);

      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current, { zoomControl: true }).setView([20, 0], 2);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cluster = (L as any).markerClusterGroup({ maxClusterRadius: 60, showCoverageOnHover: false });
      map.addLayer(cluster);
      leafletRef.current = { map, cluster, L };

      setInitializing(false);
    }

    init().catch(console.error);
    return () => { cancelled = true; };
  }, []);

  // Load markers whenever init finishes or activeYear changes
  useEffect(() => {
    if (initializing) return;
    loadMarkers(activeYear);
  }, [initializing, activeYear, loadMarkers]);

  const handleYearChange = (year: number | null) => {
    setActiveYear(year);
  };

  const withoutGps = total - visibleCount;
  const showSelector = availableYears.length > 1;

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
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
              <IconMenu size={20} />
            </button>
            <div className="topbar-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconMap size={14} />
              Mapa
            </div>
          </div>

          {showSelector && (
            <div className="map-year-selector" role="group" aria-label="Filtrar por año">
              <button
                className={`map-year-btn${activeYear === null ? ' active' : ''}`}
                onClick={() => handleYearChange(null)}
              >
                Todos
              </button>
              {availableYears.map(year => (
                <button
                  key={year}
                  className={`map-year-btn${activeYear === year ? ' active' : ''}`}
                  onClick={() => handleYearChange(year)}
                >
                  {year}
                </button>
              ))}
            </div>
          )}

          <div className="topbar-spacer" />
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', paddingRight: 4 }}>
            {loadingYear ? (
              <span>Cargando…</span>
            ) : (
              <>
                {visibleCount.toLocaleString('es')} fotos en el mapa
                {limitReached && <span title="Se muestran las 5000 más recientes"> · límite alcanzado</span>}
                {!limitReached && withoutGps > 0 && (
                  <> · <span>{withoutGps.toLocaleString('es')} sin ubicación</span></>
                )}
              </>
            )}
          </div>
        </div>

        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          {(initializing || loadingYear) && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg)', color: 'var(--text-tertiary)', fontSize: 13,
            }}>
              {initializing ? 'Cargando mapa…' : 'Cargando marcadores…'}
            </div>
          )}

          {!initializing && !loadingYear && visibleCount === 0 && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-tertiary)', fontSize: 13, pointerEvents: 'none',
            }}>
              No hay fotos con ubicación{activeYear !== null ? ` para ${activeYear}` : ''}
            </div>
          )}

          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {panelOpen && selectedPhotos.length > 0 && (
            <div className="map-panel" onClick={e => e.stopPropagation()}>
              <div className="map-panel-header">
                <span className="map-panel-title">
                  {selectedPhotos[0].event}
                  {selectedPhotos.length > 1 && (
                    <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                      ({selectedPhotos.length})
                    </span>
                  )}
                </span>
                <button className="map-panel-close" onClick={() => setPanelOpen(false)} aria-label="Cerrar panel"><IconX size={14} /></button>
              </div>
              <div className="map-panel-list">
                {selectedPhotos.map(photo => (
                  <Link key={photo.id} href={`/library/${photo.id}`} className="map-panel-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/photos/${photo.id}/thumbnail?size=120`}
                      alt={photo.filename}
                      className="map-panel-thumb"
                    />
                    <div className="map-panel-info">
                      <div className="map-panel-filename">{photo.filename}</div>
                      {photo.taken_at && (
                        <div className="map-panel-date">
                          {new Date(photo.taken_at).toLocaleDateString('es-ES', {
                            day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </div>
                      )}
                      <div className="map-panel-event">{photo.event}</div>
                      <span className="map-panel-link">Abrir foto →</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {panelOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 399 }} onClick={() => setPanelOpen(false)} />
      )}
    </div>
  );
}
