'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import type { NormalizedSet } from '@psr/providers';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CatalogSearch } from '@/components/catalog-search';
import { matchSets } from '@/lib/catalog-match';

type SetsExplorerProps = {
  sets: NormalizedSet[];
};

export function SetsExplorer({ sets }: SetsExplorerProps) {
  const [query, setQuery] = useState('');
  const onQueryChange = useCallback((q: string) => setQuery(q), []);
  const filtered = matchSets(sets, query);
  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-8">
      <header className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-semibold">Sets</h1>
          <p className="text-muted">
            Browse sets, then track your completion inside your collection.
          </p>
        </div>
        <CatalogSearch
          variant="hero"
          sets={sets}
          includeSets
          includeCards
          onQueryChange={onQueryChange}
          placeholder="Search any set or card — name, series, or #number"
          hint="Suggestions appear as you type. Use ↑↓ and Enter to jump straight to a result."
        />
      </header>

      <section aria-live="polite" aria-atomic="true">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-muted">
            {hasQuery
              ? filtered.length === 1
                ? '1 matching set'
                : `${filtered.length} matching sets`
              : `${sets.length} sets`}
          </h2>
          {hasQuery && filtered.length > 0 && (
            <p className="text-xs text-muted">
              Showing sets for “{query.trim()}”
            </p>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm text-content">No sets match “{query.trim()}”.</p>
            <p className="mt-1 text-sm text-muted">
              Keep typing for cards, or clear the search to browse every set.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {filtered.map((set) => (
              <Link key={set.externalId} href={`/sets/${set.externalId}`}>
                <Card className="h-full transition-colors hover:border-accent/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium sm:text-base">{set.name}</h3>
                      <p className="text-xs text-muted">{set.series}</p>
                    </div>
                    <Badge tone={set.language === 'ja' ? 'info' : 'neutral'}>
                      {set.language.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted">
                    <span>{set.total ?? set.printedTotal ?? '—'} cards</span>
                    <span>{set.releaseDate?.slice(0, 4)}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
