'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ValueLineChart, type SeriesPoint } from '@/components/charts/line-chart';
import { cn } from '@psr/ui';

const RANGES = ['7d', '30d', '90d', '1y', 'all'] as const;
type Range = (typeof RANGES)[number];

export function PriceHistory({
  externalId,
  initial,
  cardName,
}: {
  externalId: string;
  initial: SeriesPoint[];
  cardName: string;
}) {
  const [range, setRange] = useState<Range>('90d');
  const [data, setData] = useState<SeriesPoint[]>(initial);
  const [loading, setLoading] = useState(false);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    if (range === '90d') {
      setData(initial);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/cards/${encodeURIComponent(externalId)}/history?range=${range}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((b) => {
        if (b.success) {
          setData(b.data.points);
          setClamped(Boolean(b.data.clamped));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [range, externalId, initial]);

  const currency = data[0]?.currency ?? 'USD';

  return (
    <div>
      <div className="mb-3 flex gap-1" role="tablist" aria-label="Chart range">
        {RANGES.map((r) => (
          <button
            key={r}
            role="tab"
            aria-selected={range === r}
            onClick={() => setRange(r)}
            className={cn(
              'min-h-[36px] rounded-md px-3 text-xs font-medium',
              range === r ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface-elevated',
            )}
          >
            {r.toUpperCase()}
          </button>
        ))}
      </div>
      {clamped && (
        <p className="mb-2 text-xs text-muted">
          Showing the most recent 30 days.{' '}
          <Link href="/pricing" className="text-accent hover:underline">
            See how this card&apos;s price has moved over time with Collector.
          </Link>
        </p>
      )}
      {data.length === 0 ? (
        <p className="flex h-40 items-center justify-center text-center text-sm text-muted">
          No price history is available from the current data source yet. Daily snapshots build
          history over time.
        </p>
      ) : (
        <div className={loading ? 'opacity-50' : ''}>
          <ValueLineChart
            data={data}
            currency={currency}
            ariaLabel={`${cardName} raw price history (${range})`}
          />
        </div>
      )}
    </div>
  );
}
