import Link from 'next/link';
import type { Metadata } from 'next';
import { TrendingUp, TrendingDown, ImageIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, FreshnessBadge } from '@/components/ui/badge';
import { getMarketOverview, type Mover } from '@/lib/services/market';
import { fmtMinor, fmtPct } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Market',
  description: 'Top movers and most valuable cards from the latest Pokémon TCG sets.',
};

function Thumb({ mover }: { mover: Mover }) {
  return mover.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mover.imageUrl}
      alt={mover.name}
      loading="lazy"
      decoding="async"
      className="h-12 w-9 shrink-0 rounded object-contain"
    />
  ) : (
    <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded bg-bg-deep/60 text-faint">
      <ImageIcon size={14} aria-hidden />
    </span>
  );
}

function MoverList({ movers, emptyText }: { movers: Mover[]; emptyText: string }) {
  return (
    <ol className="divide-y divide-border">
      {movers.map((m, i) => (
        <li key={m.cardExternalId}>
          <Link
            href={`/cards/${m.cardExternalId}`}
            className="flex items-center gap-3 py-2 text-sm transition-colors hover:text-accent"
          >
            <span className="w-4 shrink-0 text-right font-mono text-xs text-faint">{i + 1}</span>
            <Thumb mover={m} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{m.name}</span>
              <span className="block truncate text-xs text-muted">
                {m.setName}
                {m.number ? ` · #${m.number}` : ''}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-mono tabular-nums">{fmtMinor(m.valueMinor)}</span>
              {m.changePct !== null && (
                <span
                  className={`block font-mono text-xs tabular-nums ${
                    m.changePct > 0
                      ? 'text-positive'
                      : m.changePct < 0
                        ? 'text-negative'
                        : 'text-muted'
                  }`}
                >
                  {fmtPct(m.changePct)}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
      {movers.length === 0 && <li className="py-3 text-sm text-muted">{emptyText}</li>}
    </ol>
  );
}

export default async function MarketPage() {
  const market = await getMarketOverview();
  const hasData =
    market.mostValuable.length + market.topGainers.length + market.topDecliners.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Market</h1>
          <p className="text-muted">
            {market.setNames.length > 0
              ? `Chase cards from ${market.setNames.join(' · ')}`
              : 'Market movers across recent sets'}
          </p>
        </div>
        <FreshnessBadge freshness={market.freshness} />
      </header>

      {!hasData ? (
        <Card>
          <p className="py-6 text-center text-sm text-muted">
            Market data is temporarily unavailable — check back in a few minutes.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>7-day gainers</CardTitle>
                <Badge tone="positive">
                  <TrendingUp size={12} aria-hidden /> Up
                </Badge>
              </CardHeader>
              <MoverList
                movers={market.topGainers}
                emptyText="No qualifying gainers this week."
              />
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>7-day decliners</CardTitle>
                <Badge tone="negative">
                  <TrendingDown size={12} aria-hidden /> Down
                </Badge>
              </CardHeader>
              <MoverList
                movers={market.topDecliners}
                emptyText="No qualifying decliners this week."
              />
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Most valuable — recent sets</CardTitle>
              <Badge tone="gold">Top {market.mostValuable.length}</Badge>
            </CardHeader>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {market.mostValuable.map((m) => (
                <li key={m.cardExternalId}>
                  <Link
                    href={`/cards/${m.cardExternalId}`}
                    className="group block rounded-lg border border-border bg-bg-deep/30 p-2 transition-colors hover:border-accent/50"
                  >
                    <span className="flex aspect-[2.5/3.5] items-center justify-center rounded bg-bg-deep/50 p-1">
                      {m.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.imageUrl}
                          alt={m.name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full rounded object-contain"
                        />
                      ) : (
                        <ImageIcon size={20} className="text-faint" aria-hidden />
                      )}
                    </span>
                    <span className="mt-1.5 block truncate text-xs font-medium group-hover:text-accent">
                      {m.name}
                      {m.number ? <span className="text-faint"> #{m.number}</span> : null}
                    </span>
                    <span className="block font-mono text-sm tabular-nums">
                      {fmtMinor(m.valueMinor)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <p className="text-xs text-muted">
        {market.freshness === 'demo'
          ? 'Prices shown are illustrative demo data, not live market values.'
          : '7-day movement is computed from Cardmarket rolling average sale prices (EUR, converted to USD at the ECB reference rate). Values are market estimates, not completed sales.'}{' '}
        Pokémon Stock Radar is not an investment advisor.
      </p>
    </div>
  );
}
