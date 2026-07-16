'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { NormalizedCard } from '@psr/providers';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type SetCardsGridProps = {
  setExternalId: string;
  initialCards: NormalizedCard[];
  initialCursor: string | null;
};

export function SetCardsGrid({
  setExternalId,
  initialCards,
  initialCursor,
}: SetCardsGridProps) {
  const [cards, setCards] = useState(initialCards);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ cursor });
      const res = await fetch(
        `/api/sets/${encodeURIComponent(setExternalId)}/cards?${params}`,
      );
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? 'Could not load more cards.');
        return;
      }
      const nextCards: NormalizedCard[] = body.data.cards ?? [];
      setCards((prev) => {
        const seen = new Set(prev.map((c) => c.externalId));
        return [...prev, ...nextCards.filter((c) => !seen.has(c.externalId))];
      });
      setCursor(body.data.nextCursor ?? null);
    } catch {
      setError('Could not load more cards. Check your connection and try again.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [cursor, setExternalId]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !cursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: '320px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  if (cards.length === 0 && !loading) {
    return (
      <p className="text-sm text-muted">No cards available for this set in demo mode.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.externalId} href={`/cards/${card.externalId}`}>
            <Card className="h-full transition-colors hover:border-accent/50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium sm:text-base">{card.name}</h3>
                  <p className="text-xs text-muted">#{card.number}</p>
                </div>
                {card.rarity && (
                  <Badge className="hidden max-w-[40%] truncate sm:inline-flex">{card.rarity}</Badge>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div ref={sentinelRef} className="flex min-h-10 flex-col items-center justify-center gap-2 py-2">
        {loading && (
          <p className="inline-flex items-center gap-2 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" aria-hidden />
            Loading more cards…
          </p>
        )}
        {error && (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            {error} Tap to retry.
          </button>
        )}
        {!cursor && !loading && cards.length > 0 && (
          <p className="text-xs text-muted">
            Showing all {cards.length} cards
          </p>
        )}
      </div>
    </div>
  );
}
