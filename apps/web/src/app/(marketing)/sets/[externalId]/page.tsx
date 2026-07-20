import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { getSet, getCardsInSetPage, SET_CARDS_PAGE_SIZE } from '@/lib/services/catalog';
import { getCurrentUser } from '@/lib/auth';
import { listOwnedCardExternalIds } from '@/lib/services/collection';
import { SetCardsGrid } from './set-cards-grid';

interface Params {
  params: Promise<{ externalId: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  try {
    const { externalId } = await params;
    const set = await getSet(externalId);
    return { title: set.name, description: `Cards, values, and completion for ${set.name}.` };
  } catch {
    return { title: 'Set' };
  }
}

export default async function SetPage({ params }: Params) {
  const { externalId } = await params;
  let set;
  try {
    set = await getSet(externalId);
  } catch {
    notFound();
  }
  const { cards, nextCursor } = await getCardsInSetPage(externalId, {
    limit: SET_CARDS_PAGE_SIZE,
  });

  // Owned-card badging: signed-in users see which cards they already have.
  const user = await getCurrentUser();
  const ownedExternalIds =
    user && !user.isDemo ? await listOwnedCardExternalIds(user.id) : [];
  // External ids are set-prefixed ("sv4pt5-193"), so prefix-matching counts
  // this set's owned cards without loading the full card list.
  const ownedInSet = new Set(
    ownedExternalIds.filter((id) => id.startsWith(`${externalId}-`)),
  ).size;
  const setTotal = set.total ?? set.printedTotal ?? 0;
  const completionPct =
    setTotal > 0 ? Math.min(100, Math.round((ownedInSet / setTotal) * 100)) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <nav className="text-sm text-muted">
        <Link href="/sets" className="hover:text-content">
          Sets
        </Link>{' '}
        / {set.name}
      </nav>

      <header>
        <h1 className="font-display text-2xl font-semibold">{set.name}</h1>
        <p className="text-muted">
          {set.series} · {set.releaseDate?.slice(0, 4)} · {set.total ?? set.printedTotal} cards
        </p>
      </header>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">Set completion</h2>
          <span className="text-xs text-muted">
            {user && !user.isDemo
              ? `${ownedInSet} of ${setTotal || '?'} cards owned`
              : 'Sign in to track your owned cards'}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-elevated">
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${user && !user.isDemo ? completionPct : 0}%` }}
            aria-hidden
          />
        </div>
        {user && !user.isDemo ? (
          <p className="mt-2 text-xs text-muted">
            {completionPct}% complete · cards you own are marked in the grid below.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Sign in and cards you own will be marked in the grid below.
          </p>
        )}
      </Card>

      <SetCardsGrid
        setExternalId={externalId}
        initialCards={cards}
        initialCursor={nextCursor}
        ownedExternalIds={ownedExternalIds}
      />
    </div>
  );
}
