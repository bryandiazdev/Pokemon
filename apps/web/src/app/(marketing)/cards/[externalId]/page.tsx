import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, FreshnessBadge } from '@/components/ui/badge';
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
import { ScanLine, Eye, Bell } from 'lucide-react';

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

  const rawByCondition = new Map(pricing.raw.map((p) => [p.condition, p]));
  const nm = rawByCondition.get('near_mint');
  const psa10 = pricing.graded.find((g) => g.gradingCompany === 'psa' && g.grade === '10');
  const multiplier = nm && psa10 ? (psa10.valueMinor / nm.valueMinor).toFixed(1) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <nav className="text-sm text-muted">
        <Link href="/sets" className="hover:text-content">
          Sets
        </Link>{' '}
        /{' '}
        {set && (
          <Link href={`/sets/${set.externalId}`} className="hover:text-content">
            {set.name}
          </Link>
        )}
      </nav>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <div className="flex aspect-[2.5/3.5] items-center justify-center rounded-xl border border-border bg-surface text-muted">
            {card.imageLargeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.imageLargeUrl} alt={`${card.name} card`} className="h-full w-full rounded-xl object-contain" />
            ) : (
              <span className="p-6 text-center text-sm">Card image unavailable in demo mode</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/scan" className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-lg border border-border text-sm hover:bg-surface-elevated">
              <ScanLine size={15} /> Scan copy
            </Link>
            <Link href="/app/watchlist" className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-border px-3 text-sm hover:bg-surface-elevated" aria-label="Add to watchlist">
              <Eye size={15} />
            </Link>
            <Link href="/app/alerts" className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-border px-3 text-sm hover:bg-surface-elevated" aria-label="Create price alert">
              <Bell size={15} />
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">{card.name}</h1>
            <p className="text-muted">
              {set?.name} · #{card.number}
              {card.rarity ? ` · ${card.rarity}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {card.artist && <Badge>Illus. {card.artist}</Badge>}
              <Badge>{card.language.toUpperCase()}</Badge>
              {card.regulationMark && <Badge>Reg {card.regulationMark}</Badge>}
              <FreshnessBadge freshness="demo" />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Raw market value</CardTitle>
              {nm && <FreshnessBadge freshness={nm.freshness} />}
            </CardHeader>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {RAW_CONDITIONS.filter((c) => c !== 'unspecified').map((cond) => {
                const p = rawByCondition.get(cond);
                return (
                  <div key={cond} className="rounded-lg bg-surface-elevated p-3">
                    <div className="text-xs text-muted">{CONDITION_LABEL[cond]}</div>
                    <div className="mt-0.5 font-medium tabular-nums">
                      {p ? fmtMinor(p.valueMinor, p.currency) : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {multiplier && (
            <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-sm">
              <Badge tone="gold">Raw → PSA 10</Badge>
              <span className="text-content">
                A PSA 10 is about <strong>{multiplier}×</strong> the raw Near Mint value here.
              </span>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Graded market values</CardTitle>
          <span className="text-xs text-muted">Comparison across grading companies</span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted">
                <th className="py-2 pr-4 font-medium">Company</th>
                <th className="py-2 pr-4 font-medium">Grade</th>
                <th className="py-2 pr-4 font-medium">Value</th>
                <th className="py-2 pr-4 font-medium">Range</th>
                <th className="py-2 font-medium">Obs.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pricing.graded.map((g, i) => (
                <tr key={i}>
                  <td className="py-2 pr-4 uppercase">{g.gradingCompany}</td>
                  <td className="py-2 pr-4">{g.grade}</td>
                  <td className="py-2 pr-4 font-medium tabular-nums">
                    {fmtMinor(g.valueMinor, g.currency)}
                  </td>
                  <td className="py-2 pr-4 text-muted tabular-nums">
                    {g.lowMinor != null ? `${fmtMinor(g.lowMinor, g.currency)}–${fmtMinor(g.highMinor ?? g.valueMinor, g.currency)}` : '—'}
                  </td>
                  <td className="py-2 text-muted">{g.sampleSize ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          Grading-company names are trademarks of their owners, shown for identification and
          comparison only. Values are illustrative demo data.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Price history</CardTitle>
            <FreshnessBadge freshness="demo" />
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
                    <dd className="tabular-nums">{count.toLocaleString()}</dd>
                  </div>
                ))}
              <div className="flex justify-between border-t border-border pt-1.5">
                <dt className="text-muted">Gem rate</dt>
                <dd className="tabular-nums">{((population.gemRate ?? 0) * 100).toFixed(1)}%</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted">Demo data. Not affiliated with PSA.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
