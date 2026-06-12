'use client';

import dynamic from 'next/dynamic';
import type { Theme, CatalogRow } from '@/lib/types';

const MapClient = dynamic(() => import('./MapClient'), { ssr: false });

interface Props {
  total: number;
  withGps: number;
  themes: Theme[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  availableYears: number[];
  initialYear: number | null;
  catalogs?: CatalogRow[];
  activeCatalogId?: number;
}

export default function MapWrapper(props: Props) {
  return <MapClient {...props} />;
}
