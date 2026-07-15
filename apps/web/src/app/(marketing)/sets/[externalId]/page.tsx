import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSet, getCardsInSet } from '@/lib/services/catalog';

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
  const cards = await getCardsInSet(externalId);

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
          <h1 className="text-2xl font-semibold">{set.name}</h1>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.externalId} href={`/cards/${card.externalId}`}>
            <Card className="h-full transition-colors hover:border-accent/50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-medium">{card.name}</h3>
                  <p className="text-xs text-muted">#{card.number}</p>
                </div>
                {card.rarity && <Badge>{card.rarity}</Badge>}
              </div>
            </Card>
          </Link>
        ))}
        {cards.length === 0 && (
          <p className="text-sm text-muted">No cards available for this set in demo mode.</p>
        )}
      </div>
    </div>
  );
}
