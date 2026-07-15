import 'server-only';
import { getRegistry } from '../providers';
import { DEMO_CARDS } from '@psr/testing';

/**
 * Market intelligence. Movers require a minimum observation count so a single
 * odd price never becomes a "trend". Demo data is derived from fixtures.
 */

const MIN_OBSERVATIONS = 5;

export interface Mover {
  cardExternalId: string;
  name: string;
  valueMinor: number;
  changePct: number;
  observations: number;
  qualifies: boolean;
}

export interface MarketOverview {
  mostValuableRaw: Mover[];
  topGainers: Mover[];
  topDecliners: Mover[];
  freshness: 'demo';
  note: string;
}

export async function getMarketOverview(): Promise<MarketOverview> {
  const registry = getRegistry();
  const rows: Mover[] = [];
  for (const card of DEMO_CARDS) {
    const raw = await registry.call('rawPricing', 'getCurrentRawPrices', (a) =>
      a.getCurrentRawPrices({ cardExternalId: card.externalId }),
    );
    const nm = raw.find((r) => r.condition === 'near_mint');
    if (!nm) continue;
    const history = await registry.call('rawPricing', 'getRawPriceHistory', (a) =>
      a.getRawPriceHistory({
        cardExternalId: card.externalId,
        from: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
      }),
    );
    const first = history[0]?.valueMinor ?? nm.valueMinor;
    const last = history[history.length - 1]?.valueMinor ?? nm.valueMinor;
    const changePct = first ? ((last - first) / first) * 100 : 0;
    const observations = nm.sampleSize ?? 0;
    rows.push({
      cardExternalId: card.externalId,
      name: card.name,
      valueMinor: nm.valueMinor,
      changePct,
      observations,
      qualifies: observations >= MIN_OBSERVATIONS,
    });
  }

  const qualified = rows.filter((r) => r.qualifies);
  return {
    mostValuableRaw: [...rows].sort((a, b) => b.valueMinor - a.valueMinor).slice(0, 8),
    topGainers: [...qualified].sort((a, b) => b.changePct - a.changePct).slice(0, 5),
    topDecliners: [...qualified].sort((a, b) => a.changePct - b.changePct).slice(0, 5),
    freshness: 'demo',
    note: `Movers require at least ${MIN_OBSERVATIONS} observations to qualify. This is not investment advice.`,
  };
}
