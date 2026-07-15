'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import type { NormalizedCard } from '@psr/providers';

/** Command-menu style card search. Debounced; keyboard accessible. */
export function CommandSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NormalizedCard[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const body = await res.json();
        if (body.success) setResults(body.data.cards ?? []);
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative max-w-md">
      <label htmlFor="card-search" className="sr-only">
        Search cards
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3">
        <Search size={16} className="text-muted" aria-hidden />
        <input
          id="card-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search cards — try “Charizard 4” or “Mew ex”"
          className="h-11 w-full bg-transparent text-sm text-content outline-none placeholder:text-muted"
          autoComplete="off"
        />
        {loading && <Loader2 size={16} className="animate-spin text-muted" aria-hidden />}
      </div>
      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-border bg-surface-elevated p-1 shadow-xl"
        >
          {results.map((c) => (
            <li key={c.externalId}>
              <button
                type="button"
                onClick={() => {
                  router.push(`/cards/${c.externalId}`);
                  setOpen(false);
                  setQuery('');
                }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface"
              >
                <span className="truncate text-content">{c.name}</span>
                <span className="shrink-0 text-xs text-muted">#{c.number}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
