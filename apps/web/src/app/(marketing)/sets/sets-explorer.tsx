'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { NormalizedSet } from '@psr/providers';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CatalogSearch } from '@/components/catalog-search';
import { matchSets } from '@/lib/catalog-match';

type SetsExplorerProps = {
  sets: NormalizedSet[];
};

const CATALOG_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-cn', label: '中文（简体）' },
  { code: 'zh-tw', label: '中文（繁體）' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ko', label: '한국어' },
] as const;

export function SetsExplorer({ sets: initialSets }: SetsExplorerProps) {
  const [query, setQuery] = useState('');
  const [lang, setLang] = useState('en');
  const [sets, setSets] = useState(initialSets);
  const [langLoading, setLangLoading] = useState(false);
  const onQueryChange = useCallback((q: string) => setQuery(q), []);

  // English arrives server-rendered; other catalogs load on demand.
  useEffect(() => {
    if (lang === 'en') {
      setSets(initialSets);
      return;
    }
    const ctrl = new AbortController();
    setLangLoading(true);
    fetch(`/api/sets?lang=${encodeURIComponent(lang)}`, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((body) => {
        if (body.success) setSets(body.data.sets ?? []);
      })
      .catch(() => {
        /* aborted or offline — keep current sets */
      })
      .finally(() => setLangLoading(false));
    return () => ctrl.abort();
  }, [lang, initialSets]);

  const filtered = matchSets(sets, query);
  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-8">
      <header className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">Sets</h1>
            <p className="text-muted">
              Browse sets, then track your completion inside your collection.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="label-strip">Language</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="psr-input w-auto min-w-[9.5rem]"
              aria-label="Catalog language"
            >
              {CATALOG_LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <CatalogSearch
          variant="hero"
          sets={sets}
          includeSets
          includeCards
          lang={lang}
          onQueryChange={onQueryChange}
          placeholder="Search any set or card — name, series, or #number"
          hint="Suggestions appear as you type. Use ↑↓ and Enter to jump straight to a result."
        />
        {langLoading && (
          <p className="text-xs text-muted" aria-live="polite">
            Loading the {CATALOG_LANGS.find((l) => l.code === lang)?.label} catalog…
          </p>
        )}
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
