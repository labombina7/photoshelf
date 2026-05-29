import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSession } from '@/lib/session';
import { getSidebarData } from '@/lib/queries/sidebar';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { executeSearch } from '@/lib/search/execute';
import Sidebar from '@/components/Sidebar';
import SearchClient from './SearchClient';

interface SearchPageProps {
  searchParams: Promise<{ q?: string; intent?: string; mode?: string }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const q = sp.q?.trim();
  if (!q) return { title: 'Búsqueda — photoshelf' };
  return { title: `"${q}" — Búsqueda — photoshelf` };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';

  // No query → send to library
  if (!q) redirect('/library');

  const catalogId = await getActiveCatalogId();
  const sidebar   = getSidebarData(catalogId);
  const forceAI   = sp.mode === 'ai';
  const result    = await executeSearch(q, catalogId, forceAI);

  return (
    <div className="app-shell">
      <Sidebar
        themes={sidebar.themes}
        projects={sidebar.projects}
        totalPhotos={sidebar.totalPhotos}
        favoriteCount={sidebar.favoriteCount}
        untaggedCount={sidebar.untaggedCount}
        catalogs={sidebar.catalogs}
        activeCatalogId={catalogId}
      />

      <main className="main" role="main" aria-label="Resultados de búsqueda">
        <div className="topbar topbar--search-desktop">
          <span className="topbar-title">Búsqueda</span>
          <span className="topbar-sub">{q}</span>
        </div>

        <div className="search-results-container">
          <SearchClient result={result} />
        </div>
      </main>
    </div>
  );
}
