import 'server-only';
import { getRegistry } from '../providers';
import type {
  NormalizedCard,
  NormalizedSet,
  NormalizedPrice,
  NormalizedGradedPrice,
  NormalizedPricePoint,
  NormalizedPopulationReport,
} from '@psr/providers';
import type { GradingCompany } from '@psr/types';

/**
 * Catalog + pricing read service. Route handlers and pages call these thin,
 * cache-aware functions instead of touching providers directly.
 */

export async function searchCards(query: string, limit = 20): Promise<NormalizedCard[]> {
  const registry = getRegistry();
  const res = await registry.call(
    'catalog',
    'searchCards',
    (a) => a.searchCards({ query, limit }),
    { key: `catalog:search:${query}:${limit}`, ttlSeconds: 300 },
  );
  return res.cards;
}

/** Score a set against a free-text query (name + series + year + language). */
function scoreSetMatch(set: NormalizedSet, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const year = set.releaseDate?.slice(0, 4) ?? '';
  const hay = `${set.name} ${set.series ?? ''} ${year} ${set.language}`.toLowerCase();
  let score = 0;
  if (hay.includes(q)) score += 1;
  if (set.name.toLowerCase().startsWith(q)) score += 0.6;
  for (const term of q.split(/\s+/)) {
    if (!term) continue;
    if (hay.includes(term)) score += 0.4;
  }
  return score;
}

export async function searchSets(query: string, limit = 10): Promise<NormalizedSet[]> {
  const sets = await listSets();
  return sets
    .map((s) => ({ s, score: scoreSetMatch(s, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}

export async function listSets(): Promise<NormalizedSet[]> {
  return getRegistry().call('catalog', 'listSets', (a) => a.listSets({}), {
    key: 'catalog:sets',
    ttlSeconds: 3600,
  });
}

export async function getSet(externalId: string): Promise<NormalizedSet> {
  return getRegistry().call('catalog', 'getSet', (a) => a.getSet(externalId), {
    key: `catalog:set:${externalId}`,
    ttlSeconds: 3600,
  });
}

export async function getCard(externalId: string): Promise<NormalizedCard> {
  return getRegistry().call('catalog', 'getCard', (a) => a.getCard(externalId), {
    key: `catalog:card:${externalId}`,
    ttlSeconds: 3600,
  });
}

export async function getCardsInSet(setExternalId: string): Promise<NormalizedCard[]> {
  // Demo catalog: filter search results. Live adapters would page by set.
  const res = await getRegistry().call('catalog', 'searchCards', (a) =>
    a.searchCards({ query: '', setExternalId, limit: 500 }),
  );
  return res.cards.filter((c) => c.setExternalId === setExternalId);
}

export interface CardPricing {
  raw: NormalizedPrice[];
  graded: NormalizedGradedPrice[];
}

export async function getCardPricing(cardExternalId: string): Promise<CardPricing> {
  const registry = getRegistry();
  const [raw, graded] = await Promise.all([
    registry.call('rawPricing', 'getCurrentRawPrices', (a) =>
      a.getCurrentRawPrices({ cardExternalId }),
    ),
    registry.call('gradedPricing', 'getCurrentGradedPrices', (a) =>
      a.getCurrentGradedPrices({ cardExternalId }),
    ),
  ]);
  return { raw, graded };
}

export async function getRawHistory(
  cardExternalId: string,
  days: number,
): Promise<NormalizedPricePoint[]> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return getRegistry().call('rawPricing', 'getRawPriceHistory', (a) =>
    a.getRawPriceHistory({
      cardExternalId,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    }),
  );
}

export async function getPopulation(
  cardExternalId: string,
  gradingCompany: GradingCompany = 'psa',
): Promise<NormalizedPopulationReport> {
  return getRegistry().call('population', 'getPopulation', (a) =>
    a.getPopulation({ cardExternalId, gradingCompany }),
  );
}
