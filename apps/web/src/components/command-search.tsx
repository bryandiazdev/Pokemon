'use client';

import { CatalogSearch } from '@/components/catalog-search';

/** Compact command-menu search for the authenticated app header. */
export function CommandSearch() {
  return (
    <CatalogSearch
      variant="header"
      includeSets
      includeCards
      placeholder="Search cards — try “Charizard 4” or “Mew ex”"
    />
  );
}
