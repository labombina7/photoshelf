/**
 * Catalog stub — prepared for EPIC-001 (multiple catalogs).
 *
 * All repository functions that filter by catalog should call `getDefaultCatalog()`
 * and pass its `id`. Once EPIC-001 lands, this function will read the active catalog
 * from session/context instead of always returning `{ id: 1 }`.
 */
export interface Catalog {
  id: number;
}

export function getDefaultCatalog(): Catalog {
  return { id: 1 };
}
