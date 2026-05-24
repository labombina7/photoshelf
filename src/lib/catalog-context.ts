import { getSession } from './session';

/**
 * Returns the active catalog ID from the user session.
 * Defaults to 1 ("Principal") if the session has no catalogId set.
 *
 * Must be called from Server Components or Route Handlers (server-side only).
 */
export async function getActiveCatalogId(): Promise<number> {
  const session = await getSession();
  return session.catalogId ?? 1;
}
