import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { hasPhotosForYear, getYears } from '@/lib/queries/photos';
import { listGroups } from '@/lib/queries/groups';
import { getSidebarData } from '@/lib/queries/sidebar';
import LibraryClient from './LibraryClient';

interface SearchParams {
  year?: string;   // absent = redirect to current year; 'all' = show every year explicitly
  event?: string;
  theme?: string;
  favorite?: string;
  untagged?: string;
  q?: string;
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const sp = await searchParams;

  // 'year=all' means the user explicitly chose "Todos los años" — skip redirect.
  // No year param at all (fresh entry) → redirect to current year if photos exist for it.
  if (!sp.year && !sp.event && !sp.theme && !sp.favorite && !sp.untagged && !sp.q) {
    const currentYear = new Date().getFullYear();
    if (hasPhotosForYear(currentYear)) {
      redirect(`/library?year=${currentYear}`);
    }
  }

  // Treat 'all' sentinel as no year filter
  const effectiveYear = sp.year && sp.year !== 'all' ? sp.year : undefined;

  const { groups, total: filteredTotal } = listGroups({
    year:     effectiveYear,
    event:    sp.event,
    theme:    sp.theme,
    favorite: sp.favorite,
    untagged: sp.untagged,
    q:        sp.q,
  });

  const years   = getYears();
  const sidebar = getSidebarData();

  return (
    <LibraryClient
      groups={groups}
      total={sidebar.totalPhotos}
      filteredTotal={filteredTotal}
      years={years}
      themes={sidebar.themes}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
      activeYear={effectiveYear ?? null}
      activeFilters={{ year: effectiveYear, event: sp.event, theme: sp.theme, favorite: sp.favorite, untagged: sp.untagged, q: sp.q }}
      projects={sidebar.projects}
    />
  );
}
