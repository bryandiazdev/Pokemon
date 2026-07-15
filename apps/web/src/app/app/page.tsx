import { Stat } from '@/components/stat';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { FreshnessBadge } from '@/components/ui/badge';
import { DemoBanner } from '@/components/disclaimer';
import { ValueLineChart } from '@/components/charts/line-chart';
import { getPortfolioSummary, getPortfolioHistory } from '@/lib/services/portfolio';
import { fmtMoney, fmtMinor } from '@/lib/format';
import { isDemo } from '@/lib/env';
import Link from 'next/link';
import { ScanLine, Plus } from 'lucide-react';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const [summary, history] = await Promise.all([
    getPortfolioSummary(),
    getPortfolioHistory(90),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {isDemo && <DemoBanner />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Your collection</h1>
        <div className="flex gap-2">
          <Link
            href="/app/scan"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-bg hover:bg-accent-strong"
          >
            <ScanLine size={16} /> Scan a card
          </Link>
          <Link
            href="/app/collection/add"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-elevated"
          >
            <Plus size={16} /> Add manually
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Total value"
          value={fmtMoney(summary.totalMarketValue)}
          delta={summary.unrealizedGainPct}
          sub="unrealized"
        />
        <Stat label="Cost basis" value={fmtMoney(summary.totalCostBasis)} />
        <Stat
          label="Unrealized P/L"
          value={fmtMoney(summary.unrealizedGain)}
          delta={summary.unrealizedGainPct}
        />
        <Stat
          label="Cards"
          value={String(summary.totalPhysicalCards)}
          sub={`${summary.uniqueCards} unique · ${summary.gradedCount} graded`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Collection value over time</CardTitle>
          <FreshnessBadge freshness={summary.freshness} />
        </CardHeader>
        <ValueLineChart
          data={history}
          currency={summary.currency}
          ariaLabel="Collection value over the last 90 days"
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardTitle>Raw vs graded</CardTitle>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Raw value</dt>
              <dd className="tabular-nums">{fmtMoney(summary.rawValue)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Graded value</dt>
              <dd className="tabular-nums">{fmtMoney(summary.gradedValue)}</dd>
            </div>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
            <Link href="/app/collection" className="text-xs text-accent hover:underline">
              View all
            </Link>
          </CardHeader>
          <ul className="divide-y divide-border">
            {summary.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/cards/${item.cardExternalId}`} className="truncate font-medium hover:text-accent">
                    {item.name}
                  </Link>
                  <div className="text-xs text-muted">
                    {item.gradeLabel} · ×{item.quantity}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular-nums">{fmtMoney(item.lineValue)}</div>
                  <div
                    className={`text-xs tabular-nums ${item.gain.minor >= 0 ? 'text-positive' : 'text-negative'}`}
                  >
                    {item.gain.minor >= 0 ? '+' : ''}
                    {fmtMinor(item.gain.minor, summary.currency)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
