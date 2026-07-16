import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSet, getCardsInSetPage, SET_CARDS_PAGE_SIZE } from '@/lib/services/catalog';
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <nav className="text-sm text-muted">
        <Link href="/sets" className="hover:text-content">
          Sets
        </Link>{' '}
        / {set.name}
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{set.name}</h1>
          <p className="text-muted">
            {set.series} · {set.releaseDate?.slice(0, 4)} · {set.total ?? set.printedTotal} cards
          </p>
        </div>
        <Badge tone="demo">Demo catalog</Badge>
      </header>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">Set completion</h2>
          <span className="text-xs text-muted">Sign in to track your owned cards</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-elevated">
          <div className="h-full w-[8%] rounded-full bg-accent" aria-hidden />
        </div>
        <p className="mt-2 text-xs text-muted">
          Choose your completion rule (numbered set, master set, every finish, or every language)
          in your collection settings.
        </p>
      </Card>

      <SetCardsGrid
        setExternalId={externalId}
        initialCards={cards}
        initialCursor={nextCursor}
      />
    </div>
  );
}
