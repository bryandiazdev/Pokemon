'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, Layers, Sparkles, X } from 'lucide-react';
import { cn } from '@psr/ui';
import type { NormalizedCard, NormalizedSet } from '@psr/providers';
import { matchSets } from '@/lib/catalog-match';

export type CatalogSearchHit =
  | { kind: 'set'; set: NormalizedSet }
  | { kind: 'card'; card: NormalizedCard }
  | { kind: 'suggestion'; label: string; query: string };

const EXAMPLE_QUERIES = [
  { label: 'Charizard 4', query: 'Charizard 4' },
  { label: 'Base Set', query: 'Base Set' },
  { label: 'Mew ex', query: 'Mew ex' },
  { label: 'Paldean Fates', query: 'Paldean Fates' },
] as const;

type CatalogSearchProps = {
  /** Visual density. `hero` is for the sets page; `header` for the app shell. */
  variant?: 'header' | 'hero';
  /** When provided, sets are matched instantly (no network) and shown in the listbox. */
  sets?: NormalizedSet[];
  includeSets?: boolean;
  includeCards?: boolean;
  /** Notify parent of query changes (e.g. to filter a grid). */
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  className?: string;
  /** Optional hint shown under the hero input. */
  hint?: ReactNode;
};

type FlatItem =
  | { type: 'heading'; id: string; label: string }
  | { type: 'set'; id: string; set: NormalizedSet }
  | { type: 'card'; id: string; card: NormalizedCard }
  | { type: 'suggestion'; id: string; label: string; query: string };

/**
 * Master catalog typeahead — sets + cards, debounced fetch, keyboard nav.
 * Empty focus shows recommended queries and (when available) featured sets.
 */
export function CatalogSearch({
  variant = 'header',
  sets = [],
  includeSets = true,
  includeCards = true,
  onQueryChange,
  placeholder = 'Search sets or cards — try “Charizard 4” or “Base Set”',
  className,
  hint,
}: CatalogSearchProps) {
  const reactId = useId();
  const inputId = `catalog-search-${reactId}`;
  const listboxId = `catalog-listbox-${reactId}`;

  const [query, setQuery] = useState('');
  const [cardResults, setCardResults] = useState<NormalizedCard[]>([]);
  const [remoteSets, setRemoteSets] = useState<NormalizedSet[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onQueryChangeRef = useRef(onQueryChange);
  onQueryChangeRef.current = onQueryChange;

  const trimmed = query.trim();
  const hasLocalSets = sets.length > 0;
  const localSets =
    includeSets && hasLocalSets && trimmed.length >= 1
      ? matchSets(sets, trimmed).slice(0, 6)
      : [];
  // Prefer instant local matches; fall back to API sets (e.g. app header).
  const matchedSets = hasLocalSets ? localSets : remoteSets.slice(0, 6);

  // Featured recommendations when focused with an empty query.
  const featuredSets = includeSets && trimmed.length === 0 ? sets.slice(0, 4) : [];

  useEffect(() => {
    const needCards = includeCards && trimmed.length >= 2;
    const needRemoteSets = includeSets && !hasLocalSets && trimmed.length >= 1;
    if (!needCards && !needRemoteSets) {
      setCardResults([]);
      setRemoteSets([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const types =
          needCards && needRemoteSets
            ? 'cards,sets'
            : needCards
              ? 'cards'
              : 'sets';
        const params = new URLSearchParams({
          q: trimmed,
          limit: '12',
          types,
        });
        const res = await fetch(`/api/search?${params}`, { signal: ctrl.signal });
        const body = await res.json();
        if (body.success) {
          if (needCards) setCardResults(body.data.cards ?? []);
          if (needRemoteSets) setRemoteSets(body.data.sets ?? []);
        }
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [trimmed, includeCards, includeSets, hasLocalSets]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const flatItems: FlatItem[] = [];

  if (open && trimmed.length === 0) {
    flatItems.push({ type: 'heading', id: 'h-try', label: 'Try searching' });
    for (const s of EXAMPLE_QUERIES) {
      flatItems.push({
        type: 'suggestion',
        id: `sug-${s.query}`,
        label: s.label,
        query: s.query,
      });
    }
    if (featuredSets.length > 0) {
      flatItems.push({ type: 'heading', id: 'h-feat', label: 'Featured sets' });
      for (const set of featuredSets) {
        flatItems.push({ type: 'set', id: `feat-${set.externalId}`, set });
      }
    }
  } else if (open && trimmed.length >= 1) {
    if (matchedSets.length > 0) {
      flatItems.push({ type: 'heading', id: 'h-sets', label: 'Sets' });
      for (const set of matchedSets) {
        flatItems.push({ type: 'set', id: `set-${set.externalId}`, set });
      }
    }
    if (includeCards && trimmed.length >= 2 && cardResults.length > 0) {
      flatItems.push({ type: 'heading', id: 'h-cards', label: 'Cards' });
      for (const card of cardResults) {
        flatItems.push({ type: 'card', id: `card-${card.externalId}`, card });
      }
    }
  }

  const selectable = flatItems.filter((i) => i.type !== 'heading');
  const showEmpty =
    open &&
    trimmed.length >= 2 &&
    !loading &&
    matchedSets.length === 0 &&
    cardResults.length === 0;
  const showPanel =
    open && (flatItems.length > 0 || showEmpty || (loading && trimmed.length >= 1));

  function setQueryAndNotify(next: string) {
    setQuery(next);
    onQueryChangeRef.current?.(next);
    setOpen(true);
    setActiveIndex(-1);
  }

  function clearQuery() {
    setQuery('');
    onQueryChangeRef.current?.('');
    setCardResults([]);
    setRemoteSets([]);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function activateItem(item: FlatItem) {
    if (item.type === 'heading') return;
    if (item.type === 'suggestion') {
      setQueryAndNotify(item.query);
      return;
    }
    if (item.type === 'set') {
      router.push(`/sets/${item.set.externalId}`);
      setOpen(false);
      setQuery('');
      onQueryChangeRef.current?.('');
      return;
    }
    router.push(`/cards/${item.card.externalId}`);
    setOpen(false);
    setQuery('');
    onQueryChangeRef.current?.('');
  }

  function goToSet(externalId: string) {
    router.push(`/sets/${externalId}`);
    setOpen(false);
    setQuery('');
    onQueryChangeRef.current?.('');
  }

  function goToCard(externalId: string) {
    router.push(`/cards/${externalId}`);
    setOpen(false);
    setQuery('');
    onQueryChangeRef.current?.('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showPanel) {
      if (e.key === 'ArrowDown') setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, selectable.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && selectable[activeIndex]) {
        activateItem(selectable[activeIndex]!);
      } else if (matchedSets.length === 1 && trimmed.length >= 1) {
        goToSet(matchedSets[0]!.externalId);
      } else if (cardResults.length === 1) {
        goToCard(cardResults[0]!.externalId);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const isHero = variant === 'hero';
  let selectableCursor = -1;

  return (
    <div ref={boxRef} className={cn('relative', isHero ? 'w-full' : 'max-w-md', className)}>
      <label htmlFor={inputId} className="sr-only">
        Search sets and cards
      </label>
      <div
        className={cn(
          'flex items-center gap-2 border border-border bg-surface-elevated transition-shadow',
          isHero
            ? 'rounded-2xl px-4 shadow-lg shadow-black/5 focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/20'
            : 'rounded-lg px-3',
        )}
      >
        <Search
          size={isHero ? 20 : 16}
          className="shrink-0 text-muted"
          aria-hidden
        />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 && selectable[activeIndex]
              ? `${listboxId}-${selectable[activeIndex]!.id}`
              : undefined
          }
          value={query}
          onChange={(e) => setQueryAndNotify(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full bg-transparent text-content outline-none placeholder:text-muted',
            isHero ? 'h-14 text-base' : 'h-11 text-sm',
          )}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <Loader2 size={16} className="shrink-0 animate-spin text-muted" aria-hidden />}
        {query && !loading && (
          <button
            type="button"
            onClick={clearQuery}
            className="rounded-md p-1 text-muted transition-colors hover:bg-surface hover:text-content"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {isHero && hint && <p className="mt-2 text-sm text-muted">{hint}</p>}

      {showPanel && (
        <ul
          id={listboxId}
          role="listbox"
          className={cn(
            'absolute z-50 mt-2 max-h-[min(28rem,70vh)] w-full overflow-auto border border-border bg-surface-elevated p-1.5 shadow-xl',
            isHero ? 'rounded-2xl' : 'rounded-lg',
          )}
        >
          {showEmpty && (
            <li className="px-3 py-6 text-center text-sm text-muted">
              No sets or cards match “{trimmed}”. Try a name, set, or collector number.
            </li>
          )}
          {flatItems.map((item) => {
            if (item.type === 'heading') {
              return (
                <li
                  key={item.id}
                  role="presentation"
                  className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted"
                >
                  {item.label}
                </li>
              );
            }

            selectableCursor += 1;
            const idx = selectableCursor;
            const active = idx === activeIndex;
            const optionId = `${listboxId}-${item.id}`;

            if (item.type === 'suggestion') {
              return (
                <li key={item.id} role="option" id={optionId} aria-selected={active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => activateItem(item)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                      active ? 'bg-surface text-content' : 'text-content hover:bg-surface',
                    )}
                  >
                    <Sparkles size={16} className="shrink-0 text-muted" aria-hidden />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            }

            if (item.type === 'set') {
              const set = item.set;
              return (
                <li key={item.id} role="option" id={optionId} aria-selected={active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => activateItem(item)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      active ? 'bg-surface' : 'hover:bg-surface',
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg text-muted">
                      <Layers size={16} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-content">
                        {set.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {[set.series, set.releaseDate?.slice(0, 4), set.language.toUpperCase()]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {set.total ?? set.printedTotal ?? '—'} cards
                    </span>
                  </button>
                </li>
              );
            }

            const card = item.card;
            const setLabel =
              sets.find((s) => s.externalId === card.setExternalId)?.name ?? card.setExternalId;
            return (
              <li key={item.id} role="option" id={optionId} aria-selected={active}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => activateItem(item)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                    active ? 'bg-surface' : 'hover:bg-surface',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-content">
                      {card.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {setLabel}
                      {card.rarity ? ` · ${card.rarity}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted">#{card.number}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
