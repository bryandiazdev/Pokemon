import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, FreshnessBadge } from '@/components/ui/badge';
import { Slab } from '@/components/ui/slab';
import { PriceHistory } from '@/components/card/price-history';
import {
  getCard,
  getSet,
  getCardPricing,
  getRawHistory,
  getPopulation,
} from '@/lib/services/catalog';
import { fmtMinor } from '@/lib/format';
import { RAW_CONDITIONS, type RawCondition } from '@psr/types';
import { getCurrentUser } from '@/lib/auth';
import { listCollectionItems } from '@/lib/services/collection';
import { isWatched } from '@/lib/services/watchlist';
import { CollectionActions, type OwnedCopy } from '@/components/card/collection-actions';
import { WatchButton } from '@/components/card/watch-button';
import { ScanLine } from 'lucide-react';

interface Params {
  params: Promise<{ externalId: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  try {
    const { externalId } = await params;
    const card = await getCard(externalId);
    return {
      title: `${card.name} #${card.number}`,
      description: `Raw and graded market values, price history, and grade potential for ${card.name}.`,
    };
  } catch {
    return { title: 'Card' };
  }
}

const CONDITION_LABEL: Record<RawCondition, string> = {
  near_mint: 'Near Mint',
  lightly_played: 'Lightly Played',
  moderately_played: 'Moderately Played',
  heavily_played: 'Heavily Played',
  damaged: 'Damaged',
  unspecified: 'Unspecified',
};

export default async function CardPage({ params }: Params) {
  const { externalId } = await params;
  let card;
  try {
    card = await getCard(externalId);
  } catch {
    notFound();
  }
  const [set, pricing, history, population] = await Promise.all([
    getSet(card.setExternalId).catch(() => null),
    getCardPricing(externalId),
    getRawHistory(externalId, 90),
    getPopulation(externalId, 'psa').catch(() => null),
  ]);

  // Signed-in users see (and can manage) their copies of this card.
  let signedIn = false;
  let owned: OwnedCopy[] = [];
  let watched = false;
  try {
    const user = await getCurrentUser();
    signedIn = Boolean(user && !user.isDemo);
    if (signedIn) {
      watched = await isWatched(user!.id, externalId);
      const items = await listCollectionItems(user!.id);
      owned = items
        .filter((i) => i.cardExternalId === externalId)
        .map((i) => ({
          id: i.id,
          quantity: i.quantity,
          label:
            i.ownershipType === 'graded'
              ? `${i.gradingCompany?.toUpperCase() ?? ''} ${i.grade ?? ''}`.trim()
              : (i.rawCondition ?? 'near_mint').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
        }));
    }
  } catch {
    // Collection lookup is an enhancement — the card page renders without it.
  }

  // Everything is USD; prefer native TCGplayer USD prices over Cardmarket
  // values that were FX-converted from EUR.
  const rawByCondition = new Map<string | undefined, (typeof pricing.raw)[number]>();
  for (const p of pricing.raw) {
    const existing = rawByCondition.get(p.condition);
    if (!existing || (existing.fxConverted && !p.fxConverted)) {
      rawByCondition.set(p.condition, p);
    }
  }
  const anyConverted = [...rawByCondition.values()].some((p) => p.fxConverted);
  const nm = rawByCondition.get('near_mint');
  const psa10 = pricing.graded.find((g) => g.gradingCompany === 'psa' && g.grade === '10');
  // Only compare like with like: a demo-fixture PSA 10 against a live raw
  // price yields nonsense multipliers (e.g. "a PSA 10 is 0.2× raw").
  const comparable =
    nm && psa10 && (nm.freshness === 'demo') === (psa10.freshness === 'demo');
  const multiplier = comparable ? (psa10!.valueMinor / nm!.valueMinor).toFixed(1) : null;
  const premium = /rare|holo|illustration|special|secret|\bex\b|full art/i.test(card.rarity ?? '');

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <nav className="label-strip">
        <Link href="/sets" className="hover:text-muted">
          Sets
        </Link>
        {set && (
          <>
            {' / '}
            <Link href={`/sets/${set.externalId}`} className="hover:text-muted">
              {set.name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 md:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <Slab
            imageUrl={card.imageLargeUrl ?? card.imageSmallUrl}
            name={card.name}
            setName={set?.name ?? null}
            number={card.number}
            premium={premium}
          />
          <div className="flex flex-wrap gap-2">
            <Link
              href="/app/scan"
              className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-sm transition-colors hover:border-border-strong hover:bg-surface-elevated"
            >
              <ScanLine size={15} /> Scan copy
            </Link>
            <WatchButton
              cardExternalId={externalId}
              signedIn={signedIn}
              initialWatched={watched}
            />
          </div>
          <CollectionActions
            cardExternalId={externalId}
            cardName={card.name}
            owned={owned}
            signedIn={signedIn}
          />
        </div>

        <div className="space-y-5">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-content">
              {card.name}
            </h1>
            <p className="mt-1 text-muted">
              {set?.name} · #{card.number}
              {card.rarity ? ` · ${card.rarity}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {card.artist && <Badge>ILLUS. {card.artist.toUpperCase()}</Badge>}
              <Badge>{card.language.toUpperCase()}</Badge>
              {card.regulationMark && <Badge>REG {card.regulationMark}</Badge>}
              <FreshnessBadge freshness={nm?.freshness ?? 'demo'} />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Raw market value</CardTitle>
              {nm && <FreshnessBadge freshness={nm.freshness} />}
            </CardHeader>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {RAW_CONDITIONS.filter((c) => c !== 'unspecified').map((cond) => {
                const p = rawByCondition.get(cond);
                return (
                  <div
                    key={cond}
                    className="rounded-lg border border-border bg-bg-deep/40 p-3"
                  >
                    <div className="label-strip">{CONDITION_LABEL[cond]}</div>
                    <div className="mt-1 font-mono text-base font-medium tabular text-content">
                      {p ? `${p.fxConverted ? '≈' : ''}${fmtMinor(p.valueMinor, p.currency)}` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
            {anyConverted && (
              <p className="mt-3 text-xs text-muted">
                ≈ Converted from Cardmarket EUR at the current ECB reference rate.
              </p>
            )}
          </Card>

          {multiplier && (
            <div className="flex items-center gap-3 rounded-lg border border-gold/30 bg-gold/8 px-4 py-3 text-sm">
              <Badge tone="gold">RAW → PSA 10</Badge>
              <span className="text-content">
                A PSA 10 is about{' '}
                <strong className="font-mono text-gold">{multiplier}×</strong> the raw Near Mint
                value here.
              </span>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Graded market values</CardTitle>
          <span className="label-strip">Across grading companies</span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="label-strip text-left">
                <th className="py-2 pr-4 font-normal">Company</th>
                <th className="py-2 pr-4 font-normal">Grade</th>
                <th className="py-2 pr-4 font-normal">Value</th>
                <th className="py-2 pr-4 font-normal">Range</th>
                <th className="py-2 font-normal">Obs.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pricing.graded.map((g, i) => (
                <tr key={i} className="transition-colors hover:bg-surface-elevated/40">
                  <td className="py-2.5 pr-4 font-mono uppercase text-content">{g.gradingCompany}</td>
                  <td className="py-2.5 pr-4 font-mono text-content">{g.grade}</td>
                  <td className="py-2.5 pr-4 font-mono font-medium tabular text-content">
                    {fmtMinor(g.valueMinor, g.currency)}
                  </td>
                  <td className="py-2.5 pr-4 font-mono tabular text-muted">
                    {g.lowMinor != null
                      ? `${fmtMinor(g.lowMinor, g.currency)}–${fmtMinor(g.highMinor ?? g.valueMinor, g.currency)}`
                      : '—'}
                  </td>
                  <td className="py-2.5 font-mono text-muted">{g.sampleSize ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          Grading-company names are trademarks of their owners, shown for identification and
          comparison only.{' '}
          {pricing.graded[0]?.market === 'ebay-asks'
            ? 'Values are estimated from current eBay asking prices for graded listings (not completed sales): the typical lower ask, with the range spanning cheapest ask to median.'
            : pricing.graded[0]?.freshness === 'live'
              ? 'Live market values via PriceCharting, derived from sold listings; grades 7–9.5 aggregate across grading companies.'
              : 'Values are illustrative demo data.'}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Price history</CardTitle>
            <FreshnessBadge freshness={history[0]?.freshness ?? 'demo'} />
          </CardHeader>
          <PriceHistory externalId={externalId} initial={history} cardName={card.name} />
        </Card>

        {population && (
          <Card>
            <CardTitle>PSA population</CardTitle>
            <dl className="mt-3 space-y-1.5 text-sm">
              {Object.entries(population.byGrade)
                .sort((a, b) => Number(b[0]) - Number(a[0]))
                .map(([grade, count]) => (
                  <div key={grade} className="flex justify-between">
                    <dt className="text-muted">Grade {grade}</dt>
                    <dd className="font-mono tabular text-content">{count.toLocaleString()}</dd>
                  </div>
                ))}
              <div className="flex justify-between border-t border-border pt-1.5">
                <dt className="text-muted">Gem rate</dt>
                <dd className="font-mono tabular text-content">
                  {((population.gemRate ?? 0) * 100).toFixed(1)}%
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted">Demo data. Not affiliated with PSA.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
