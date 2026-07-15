import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, FreshnessBadge } from '@/components/ui/badge';
import { getMarketOverview, type Mover } from '@/lib/services/market';
import { fmtMinor, fmtPct } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Market',
  description: 'Most valuable cards and market movers across the Pokémon TCG.',
};

function MoverList({ movers, showChange = true }: { movers: Mover[]; showChange?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {movers.map((m) => (
        <li key={m.cardExternalId} className="flex items-center justify-between gap-2 py-2 text-sm">
          <Link href={`/cards/${m.cardExternalId}`} className="truncate hover:text-accent">
            {m.name}
          </Link>
          <div className="flex items-center gap-3">
            <span className="tabular-nums">{fmtMinor(m.valueMinor)}</span>
            {showChange && (
              <span
                className={`tabular-nums ${m.changePct > 0 ? 'text-positive' : m.changePct < 0 ? 'text-negative' : 'text-muted'}`}
              >
                {fmtPct(m.changePct)}
              </span>
            )}
          </div>
        </li>
      ))}
      {movers.length === 0 && (
        <li className="py-3 text-sm text-muted">
          Not enough qualifying observations yet to show movers.
        </li>
      )}
    </ul>
  );
}

export default async function MarketPage() {
  const market = await getMarketOverview();
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Market</h1>
          <p className="text-muted">{market.note}</p>
        </div>
        <FreshnessBadge freshness={market.freshness} />
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most valuable (raw NM)</CardTitle>
            <Badge tone="gold">Top</Badge>
          </CardHeader>
          <MoverList movers={market.mostValuableRaw} showChange={false} />
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>7-day gainers</CardTitle>
              <Badge tone="positive">Up</Badge>
            </CardHeader>
            <MoverList movers={market.topGainers} />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>7-day decliners</CardTitle>
              <Badge tone="negative">Down</Badge>
            </CardHeader>
            <MoverList movers={market.topDecliners} />
          </Card>
        </div>
      </div>
      <p className="text-xs text-muted">
        Pokémon Stock Radar is not an investment advisor. Prices shown are illustrative demo data,
        not live market values or completed sales.
      </p>
    </div>
  );
}
