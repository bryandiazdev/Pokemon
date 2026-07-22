import Link from 'next/link';
import { ImageIcon, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge, FreshnessBadge } from '@/components/ui/badge';
import { getCardPricing } from '@/lib/services/catalog';
import { getCardPulse, type CardPulse } from '@/lib/services/market';
import { listWatchlist, type WatchlistRow } from '@/lib/services/watchlist';
import { getCurrentUser } from '@/lib/auth';
import { RemoveWatchButton } from '@/components/watchlist/remove-watch-button';
import { DEMO_CARDS } from '@psr/testing';
import { fmtMinor, fmtPct } from '@/lib/format';
import type { DataFreshness } from '@psr/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Watchlist' };

interface DisplayRow {
  key: string;
  itemId: string | null; // null in demo mode (not removable)
  cardExternalId: string | null;
  name: string;
  number: string | null;
  setName: string | null;
  imageUrl: string | null;
  pulse: CardPulse | null;
}

/** Demo watchlist: a couple of fixture cards, read-only. */
const DEMO_WATCHED = ['sv2a-jp-201', 'promo-swsh-244'];

async function demoRows(): Promise<{ rows: DisplayRow[]; freshness: DataFreshness }> {
  const rows = await Promise.all(
    DEMO_WATCHED.map(async (id): Promise<DisplayRow> => {
      const card = DEMO_CARDS.find((c) => c.externalId === id)!;
      let pulse: CardPulse | null = null;
      try {
        const pricing = await getCardPricing(id);
        const nm = pricing.raw.find((r) => r.condition === 'near_mint');
        if (nm) pulse = { valueMinor: nm.valueMinor, changePct: null, freshness: 'demo' };
      } catch {
        // fixture without pricing — show the row without a value
      }
      return {
        key: id,
        itemId: null,
        cardExternalId: id,
        name: card.name,
        number: card.number,
        setName: null,
        imageUrl: null,
        pulse,
      };
    }),
  );
  return { rows, freshness: 'demo' };
}

async function liveRows(userId: string): Promise<{ rows: DisplayRow[]; freshness: DataFreshness }> {
  const items = await listWatchlist(userId);
  const rows = await Promise.all(
    items.map(async (item: WatchlistRow): Promise<DisplayRow> => {
      const pulse = item.cardExternalId ? await getCardPulse(item.cardExternalId) : null;
      return {
        key: item.id,
        itemId: item.id,
        cardExternalId: item.cardExternalId,
        name: item.name,
        number: item.number,
        setName: item.setName,
        imageUrl: item.imageUrl,
        pulse,
      };
    }),
  );
  const freshness: DataFreshness =
    rows.some((r) => r.pulse && r.pulse.freshness !== 'demo') ? 'live' : 'demo';
  return { rows, freshness };
}

export default async function WatchlistPage() {
  const user = await getCurrentUser();
  const live = Boolean(user && !user.isDemo);
  const { rows, freshness } = live ? await liveRows(user!.id) : await demoRows();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Watchlist</h1>
          <p className="text-sm text-muted">
            {rows.length > 0
              ? `${rows.length} card${rows.length === 1 ? '' : 's'} · prices update through the day`
              : 'Track prices on cards you don’t own yet.'}
          </p>
        </div>
        <FreshnessBadge freshness={freshness} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Eye size={22} className="text-accent" aria-hidden />
            <p className="max-w-sm text-sm text-muted">
              Your watchlist is empty. Open any card and hit{' '}
              <span className="font-medium text-content">Watch</span> to track its market value
              here — chase cards, grails, or anything you’re waiting to buy.
            </p>
            <Link
              href="/market"
              className="inline-flex min-h-[40px] items-center rounded-lg border border-border px-4 text-sm transition-colors hover:border-border-strong hover:bg-surface-elevated"
            >
              Browse market movers
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.key} className="flex items-center gap-3 py-2.5">
                {row.cardExternalId ? (
                  <Link
                    href={`/cards/${row.cardExternalId}`}
                    className="flex min-w-0 flex-1 items-center gap-3 hover:text-accent"
                  >
                    <WatchRowBody row={row} />
                  </Link>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <WatchRowBody row={row} />
                  </span>
                )}
                {row.itemId ? (
                  <RemoveWatchButton itemId={row.itemId} label={row.name} />
                ) : (
                  <Badge tone="info">Watching</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-xs text-muted">
        Values are current market estimates (Near Mint raw), with 7-day movement from Cardmarket
        rolling averages where available. Not investment advice.
      </p>
    </div>
  );
}

function WatchRowBody({ row }: { row: DisplayRow }) {
  return (
    <>
      {row.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.imageUrl}
          alt={row.name}
          loading="lazy"
          decoding="async"
          className="h-12 w-9 shrink-0 rounded object-contain"
        />
      ) : (
        <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded bg-bg-deep/60 text-faint">
          <ImageIcon size={14} aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{row.name}</span>
        <span className="block truncate text-xs text-muted">
          {row.setName ?? ''}
          {row.number ? `${row.setName ? ' · ' : ''}#${row.number}` : ''}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-sm tabular-nums">
          {row.pulse ? fmtMinor(row.pulse.valueMinor) : '—'}
        </span>
        {row.pulse?.changePct != null && (
          <span
            className={`block font-mono text-xs tabular-nums ${
              row.pulse.changePct > 0
                ? 'text-positive'
                : row.pulse.changePct < 0
                  ? 'text-negative'
                  : 'text-muted'
            }`}
          >
            {fmtPct(Math.round(row.pulse.changePct * 10) / 10)}
          </span>
        )}
      </span>
    </>
  );
}
