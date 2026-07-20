import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { getSharedCollection } from '@/lib/services/collection';
import { ImageIcon, ScanLine } from 'lucide-react';

interface Params {
  params: Promise<{ slug: string }>;
}

// Unlisted share links must never end up in search results.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const shared = await getSharedCollection(slug);
  if (!shared) return { title: 'Collection', robots: { index: false, follow: false } };
  return {
    title: `${shared.ownerName}’s Pokémon collection`,
    description: `${shared.items.length} cards tracked with Pokémon Stock Radar.`,
    robots: { index: false, follow: false },
  };
}

export default async function SharedCollectionPage({ params }: Params) {
  const { slug } = await params;
  const shared = await getSharedCollection(slug);
  if (!shared) notFound();

  const totalCards = shared.items.reduce((n, i) => n + i.quantity, 0);
  const gradedCount = shared.items.filter((i) => i.ownershipType === 'graded').length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <p className="label-strip">Shared collection</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {shared.ownerName}’s collection
        </h1>
        <p className="text-muted">
          {totalCards} card{totalCards === 1 ? '' : 's'}
          {gradedCount > 0 ? ` · ${gradedCount} graded` : ''} · tracked with Pokémon Stock Radar
        </p>
      </header>

      {shared.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted">
          This collection is empty right now.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shared.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col overflow-hidden rounded-xl border border-border bg-bg-deep/30"
            >
              <div className="flex items-center justify-center bg-bg-deep/60 p-1.5">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    className="h-auto max-h-64 w-full max-w-full object-contain"
                  />
                ) : (
                  <span className="flex aspect-[245/337] w-full flex-col items-center justify-center gap-2 text-faint">
                    <ImageIcon size={24} aria-hidden />
                    <span className="text-[11px]">No image</span>
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">{item.name}</span>
                  {item.quantity > 1 && (
                    <span className="shrink-0 rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-muted">
                      ×{item.quantity}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <Badge tone={item.ownershipType === 'graded' ? 'gold' : 'neutral'}>
                    {item.ownershipType === 'graded'
                      ? `${item.gradingCompany?.toUpperCase() ?? ''} ${item.grade ?? ''}`.trim()
                      : (item.rawCondition ?? 'raw').replace(/_/g, ' ')}
                  </Badge>
                  {item.setName && <span className="truncate">{item.setName}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* The conversion hook: value the viewer can't see yet. */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-6 py-8 text-center">
        <ScanLine size={22} className="text-accent" aria-hidden />
        <p className="max-w-md text-sm text-content">
          Start your own collection — scan cards with your camera, track live market values, and
          estimate grade potential before you submit.
        </p>
        <Link
          href="/sign-up"
          className="inline-flex min-h-[44px] items-center rounded-lg bg-prism px-5 text-sm font-semibold text-accent-ink transition-all hover:brightness-110"
        >
          Start free
        </Link>
        <p className="text-xs text-muted">
          Free to start · no card details required
        </p>
      </div>
    </div>
  );
}
