import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge, FreshnessBadge } from '@/components/ui/badge';
import { getCardPricing } from '@/lib/services/catalog';
import { DEMO_CARDS } from '@psr/testing';
import { fmtMinor } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Watchlist' };

// Demo watchlist: a couple of fixture cards.
const WATCHED = ['sv2a-jp-201', 'promo-swsh-244'];

export default async function WatchlistPage() {
  const rows = await Promise.all(
    WATCHED.map(async (id) => {
      const card = DEMO_CARDS.find((c) => c.externalId === id)!;
      const pricing = await getCardPricing(id);
      const nm = pricing.raw.find((r) => r.condition === 'near_mint');
      return { card, nm };
    }),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Watchlist</h1>
        <FreshnessBadge freshness="demo" />
      </div>
      <Card>
        <ul className="divide-y divide-border">
          {rows.map(({ card, nm }) => (
            <li key={card.externalId} className="flex items-center justify-between gap-3 py-3">
              <div>
                <Link href={`/cards/${card.externalId}`} className="font-medium hover:text-accent">
                  {card.name}
                </Link>
                <div className="text-xs text-muted">
                  #{card.number} · {card.language.toUpperCase()}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums">{nm ? fmtMinor(nm.valueMinor) : '—'}</span>
                <Badge tone="info">Watching</Badge>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-xs text-muted">
        Add cards to your watchlist from any card page. Set a price alert to be notified of moves.
      </p>
    </div>
  );
}
