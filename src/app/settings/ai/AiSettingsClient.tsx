'use client';

import { useState, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import SettingsNav from '@/components/SettingsNav';
import { IconMenu } from '@/components/Icons';
import { useHeaderSlot } from '@/components/HeaderSlot';
import type { Theme } from '@/lib/types';
import type { CatalogRow } from '@/lib/queries/catalogs';

interface Props {
  themes: Theme[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs?: CatalogRow[];
  activeCatalogId?: number;
}

export default function AiSettingsClient({
  themes,
  totalPhotos,
  favoriteCount,
  untaggedCount,
  catalogs = [],
  activeCatalogId,
}: Props) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useHeaderSlot(useMemo(() => (
    <div className="header-slot-library">
      <button className="hamburger header-slot-hamburger" onClick={() => setMobileSidebarOpen(true)} title="Menú">
        <IconMenu size={20} />
      </button>
    </div>
  ), []));

  return (
    <div className="app-shell">
      <Sidebar
        themes={themes}
        totalPhotos={totalPhotos}
        favoriteCount={favoriteCount}
        untaggedCount={untaggedCount}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        catalogs={catalogs}
        activeCatalogId={activeCatalogId}
      />

      <div className="main">
        <div style={{ padding: '24px 32px', maxWidth: 640 }}>
          <SettingsNav />

          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Modelos de IA</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
            Configura el proveedor de inteligencia artificial para clasificación de fotos, búsqueda semántica y análisis de estilo.
          </p>

          <div style={{
            padding: '20px 24px',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            fontSize: 13,
            color: 'var(--text-secondary)',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>Próximamente</div>
            La configuración de modelos de IA estará disponible en la próxima versión. Podrás elegir entre Ollama (local) y proveedores en la nube como Anthropic.
          </div>
        </div>
      </div>
    </div>
  );
}
