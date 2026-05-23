'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { IconMenu, IconMap } from '@/components/Icons';
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
}

export default function MapClient({ total, withGps, themes, projects, totalPhotos, favoriteCount, untaggedCount }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<{ map: L.Map; cluster: any } | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<PhotoPoint[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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
      const cluster = (L as any).markerClusterGroup({
        maxClusterRadius: 60,
        showCoverageOnHover: false,
        // Cluster icons are rendered by the plugin — no custom thumbnail needed
      });

      map.addLayer(cluster);
      leafletRef.current = { map, cluster };

      // Fetch photo points
      const res = await fetch('/api/photos/map');
      if (cancelled) return;
      const data = await res.json();
      const photos: PhotoPoint[] = data.photos ?? [];

      if (photos.length === 0) { setLoading(false); return; }

      const bounds: [number, number][] = [];

      for (const photo of photos) {
        // Use a lightweight CSS dot — no img request per marker.
        // Thumbnails load on demand in the side panel when a marker is clicked.
        const icon = L.divIcon({
          html: `<div class="map-marker-dot"></div>`,
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const marker = L.marker([photo.gps_lat, photo.gps_lon], { icon });
        (marker as unknown as { _photoData: PhotoPoint })._photoData = photo;

        marker.on('click', () => {
          // Find all photos at this exact coordinate
          const same = photos.filter(p => p.gps_lat === photo.gps_lat && p.gps_lon === photo.gps_lon);
          setSelectedPhotos(same);
          setPanelOpen(true);
        });

        cluster.addLayer(marker);
        bounds.push([photo.gps_lat, photo.gps_lon]);
      }

      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 14 });
      setLoading(false);
    }

    init().catch(console.error);
    return () => { cancelled = true; };
  }, []);

  const withoutGps = total - withGps;

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
            <div className="topbar-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconMap size={14} />
              Mapa
            </div>
          </div>
          <div className="topbar-spacer" />
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', paddingRight: 4 }}>
            {withGps.toLocaleString('es')} fotos en el mapa
            {withoutGps > 0 && <> · <span style={{ color: 'var(--text-tertiary)' }}>{withoutGps.toLocaleString('es')} sin ubicación</span></>}
          </div>
        </div>

        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg)', color: 'var(--text-tertiary)', fontSize: 13,
            }}>
              Cargando mapa…
            </div>
          )}
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {/* Side panel */}
          {panelOpen && selectedPhotos.length > 0 && (
            <div className="map-panel" onClick={e => e.stopPropagation()}>
              <div className="map-panel-header">
                <span className="map-panel-title">
                  {selectedPhotos[0].event}
                  {selectedPhotos.length > 1 && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6 }}>({selectedPhotos.length})</span>}
                </span>
                <button className="map-panel-close" onClick={() => setPanelOpen(false)}>×</button>
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
                          {new Date(photo.taken_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
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

      {/* Close panel when clicking outside */}
      {panelOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 399 }} onClick={() => setPanelOpen(false)} />
      )}
    </div>
  );
}
