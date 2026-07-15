import Link from 'next/link';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { listSets } from '@/lib/services/catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Set explorer',
  description: 'Browse Pokémon TCG sets, track completion, and value complete sets.',
};

export default async function SetsPage() {
  const sets = await listSets();
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold">Sets</h1>
        <p className="text-muted">Browse sets, then track your completion inside your collection.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sets.map((set) => (
          <Link key={set.externalId} href={`/sets/${set.externalId}`}>
            <Card className="h-full transition-colors hover:border-accent/50">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-medium">{set.name}</h2>
                  <p className="text-xs text-muted">{set.series}</p>
                </div>
                <Badge tone={set.language === 'ja' ? 'info' : 'neutral'}>
                  {set.language.toUpperCase()}
                </Badge>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span>{set.total ?? set.printedTotal ?? '—'} cards</span>
                <span>{set.releaseDate?.slice(0, 4)}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
