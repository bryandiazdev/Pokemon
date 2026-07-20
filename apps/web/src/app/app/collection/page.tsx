import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, FreshnessBadge } from '@/components/ui/badge';
import { DataModeBanner } from '@/components/data-mode-banner';
import { RemoveItemButton } from '@/components/collection/remove-item-button';
import { ShareCollection } from '@/components/collection/share-collection';
import { ExportButton } from '@/components/collection/export-button';
import { getPortfolioSummary } from '@/lib/services/portfolio';
import { fmtMoney, fmtMinor } from '@/lib/format';
import { Plus, Upload, ImageIcon } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Collection' };

export default async function CollectionPage() {
  const summary = await getPortfolioSummary();
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <DataModeBanner />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Collection</h1>
        {/* flex-wrap: four actions overflow a phone viewport in a single row. */}
        <div className="flex flex-wrap gap-2">
          <Link href="/app/collection/add" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-bg hover:bg-accent-strong">
            <Plus size={16} /> Add card
          </Link>
          <Link href="/app/collection/import" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-4 text-sm hover:bg-surface-elevated">
            <Upload size={16} /> Import
          </Link>
          <ExportButton />
          <ShareCollection />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {summary.totalPhysicalCards} cards · {fmtMoney(summary.totalMarketValue)}
          </CardTitle>
          <FreshnessBadge freshness={summary.freshness} />
        </CardHeader>

        {summary.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            No cards yet — scan one or{' '}
            <Link href="/app/collection/add" className="text-accent hover:underline">
              add one manually
            </Link>
            .
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {summary.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col overflow-hidden rounded-xl border border-border bg-bg-deep/30 transition-colors hover:border-border-strong"
              >
                <Link
                  href={`/cards/${item.cardExternalId}`}
                  className="flex items-center justify-center bg-bg-deep/60 p-1.5"
                >
                  {item.imageUrl ? (
                    // w-full h-auto: the element takes the bitmap's own aspect
                    // ratio, so nothing is stretched, letterboxed, or clipped —
                    // and no CSS border-radius, because the card artwork has its
                    // own printed rounded corners; a CSS radius shaves the
                    // card's border at the edges.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-auto max-h-72 w-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="flex aspect-[245/337] w-full flex-col items-center justify-center gap-2 text-faint">
                      <ImageIcon size={28} aria-hidden />
                      <span className="text-[11px]">No image</span>
                    </span>
                  )}
                </Link>

                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/cards/${item.cardExternalId}`}
                      className="min-w-0 text-sm font-medium leading-snug hover:text-accent"
                    >
                      {item.name}
                    </Link>
                    {item.quantity > 1 && (
                      <span className="shrink-0 rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-muted">
                        ×{item.quantity}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={item.ownershipType === 'graded' ? 'gold' : 'neutral'}>
                      {item.gradeLabel}
                    </Badge>
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-2 pt-1">
                    <div>
                      <div className="font-mono text-sm font-medium tabular text-content">
                        {fmtMoney(item.lineValue)}
                      </div>
                      <div
                        className={`font-mono text-xs tabular ${item.gain.minor >= 0 ? 'text-positive' : 'text-negative'}`}
                      >
                        {item.gain.minor >= 0 ? '+' : ''}
                        {fmtMinor(item.gain.minor, summary.currency)}
                        {item.gainPct != null && ` (${item.gainPct.toFixed(0)}%)`}
                      </div>
                    </div>
                    <RemoveItemButton itemId={item.id} label={item.name} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
