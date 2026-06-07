import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getSidebarData } from '@/lib/queries/sidebar';
import { getActiveCatalogId } from '@/lib/catalog-context';
import { getSpecContent } from '@/lib/specs';
import { marked } from 'marked';
import SpecClient from './SpecClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function SpecPage({ params }: Props) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');

  const { slug } = await params;
  const spec = getSpecContent(slug);
  if (!spec) notFound();

  const html = await marked.parse(spec.content, { async: false });

  const catalogId = await getActiveCatalogId();
  const sidebar = getSidebarData(catalogId);

  return (
    <SpecClient
      slug={slug}
      html={html as string}
      status={spec.status}
      themes={sidebar.themes}
      totalPhotos={sidebar.totalPhotos}
      favoriteCount={sidebar.favoriteCount}
      untaggedCount={sidebar.untaggedCount}
      catalogs={sidebar.catalogs}
      activeCatalogId={catalogId}
    />
  );
}
