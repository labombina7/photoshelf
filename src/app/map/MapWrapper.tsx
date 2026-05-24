'use client';

import dynamic from 'next/dynamic';
import type { Theme } from '@/lib/types';

const MapClient = dynamic(() => import('./MapClient'), { ssr: false });

interface Props {
  total: number;
  withGps: number;
  themes: Theme[];
  projects: { id: number; title: string }[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
}

export default function MapWrapper(props: Props) {
  return <MapClient {...props} />;
}
