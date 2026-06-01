import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getMemoriesForDate } from '@/lib/queries/memories';
import { getSidebarData } from '@/lib/queries/sidebar';
import { getActiveCatalogId } from '@/lib/catalog-context';
import MemoriesClient from './MemoriesClient';

interface SearchParams {
  date?: string; // MM-DD
}

export default async function MemoriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const catalogId = await getActiveCatalogId();
  const sp = await searchParams;

  let date = sp.date ?? '';
  if (!date || !/^\d{2}-\d{2}$/.test(date)) {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    date = `${mm}-${dd}`;
  }

  const [data, sidebar] = await Promise.all([
    Promise.resolve(getMemoriesForDate(date, catalogId)),
    Promise.resolve(getSidebarData(catalogId)),
  ]);

  return (
    <MemoriesClient
      initialData={data}
      initialDate={date}
      themes={sidebar.themes}
      projects={sidebar.projects}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
      catalogs={sidebar.catalogs}
      activeCatalogId={catalogId}
    />
  );
}
