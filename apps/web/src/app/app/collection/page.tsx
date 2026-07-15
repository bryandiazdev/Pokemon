import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, FreshnessBadge } from '@/components/ui/badge';
import { DemoBanner } from '@/components/disclaimer';
import { getPortfolioSummary } from '@/lib/services/portfolio';
import { fmtMoney, fmtMinor } from '@/lib/format';
import { isDemo } from '@/lib/env';
import { Plus, Download, Upload } from 'lucide-react';

export const metadata = { title: 'Collection' };

export default async function CollectionPage() {
  const summary = await getPortfolioSummary();
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {isDemo && <DemoBanner />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Collection</h1>
        <div className="flex gap-2">
          <Link href="/app/collection/add" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-bg hover:bg-accent-strong">
            <Plus size={16} /> Add card
          </Link>
          <Link href="/app/collection/import" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-4 text-sm hover:bg-surface-elevated">
            <Upload size={16} /> Import CSV
          </Link>
          <a href="/api/collection/export" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-4 text-sm hover:bg-surface-elevated">
            <Download size={16} /> Export
          </a>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {summary.totalPhysicalCards} cards · {fmtMoney(summary.totalMarketValue)}
          </CardTitle>
          <FreshnessBadge freshness={summary.freshness} />
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted">
                <th className="py-2 pr-4 font-medium">Card</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Qty</th>
                <th className="py-2 pr-4 font-medium">Cost basis</th>
                <th className="py-2 pr-4 font-medium">Value</th>
                <th className="py-2 font-medium">P/L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 pr-4">
                    <Link href={`/cards/${item.cardExternalId}`} className="font-medium hover:text-accent">
                      {item.name}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={item.ownershipType === 'graded' ? 'gold' : 'neutral'}>
                      {item.gradeLabel}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums">{item.quantity}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-muted">{fmtMoney(item.costBasis)}</td>
                  <td className="py-2.5 pr-4 tabular-nums font-medium">{fmtMoney(item.lineValue)}</td>
                  <td className={`py-2.5 tabular-nums ${item.gain.minor >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {item.gain.minor >= 0 ? '+' : ''}
                    {fmtMinor(item.gain.minor, summary.currency)}
                    {item.gainPct != null && ` (${item.gainPct.toFixed(0)}%)`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
