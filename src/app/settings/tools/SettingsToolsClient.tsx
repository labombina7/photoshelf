'use client';

import IntegrityClient from '@/app/tools/integrity/IntegrityClient';
import SettingsNav from '@/components/SettingsNav';
import type { Theme } from '@/lib/types';
import type { CatalogRow } from '@/lib/queries/catalogs';

interface Meta {
  total: number;
  orphans: number;
  unindexed: number;
  corrupt: number;
  lastRun: string | null;
}

interface Props {
  initialMeta: Meta;
  themes: Theme[];
  totalPhotos: number;
  favoriteCount: number;
  untaggedCount: number;
  catalogs?: CatalogRow[];
  activeCatalogId?: number;
}

export default function SettingsToolsClient(props: Props) {
  return (
    <IntegrityClient
      {...props}
      topSlot={<SettingsNav />}
    />
  );
}
