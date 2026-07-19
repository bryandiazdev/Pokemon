import 'server-only';
import { getRegistry } from '../providers';
import { toUsdPrices, toUsdPoints } from './fx';
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

export async function searchCards(
  query: string,
  limit = 20,
  language?: string,
): Promise<NormalizedCard[]> {
  const registry = getRegistry();
  const res = await registry.call(
    'catalog',
    'searchCards',
    (a) => a.searchCards({ query, limit, language }),
    { key: `catalog:search:${language ?? 'en'}:${query}:${limit}`, ttlSeconds: 300 },
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

export async function searchSets(
  query: string,
  limit = 10,
  language?: string,
): Promise<NormalizedSet[]> {
  const sets = await listSets(language);
  return sets
    .map((s) => ({ s, score: scoreSetMatch(s, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}

export async function listSets(language?: string): Promise<NormalizedSet[]> {
  return getRegistry().call('catalog', 'listSets', (a) => a.listSets({ language }), {
    key: `catalog:sets:${language ?? 'en'}`,
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

/** Default page size for set card grids (divisible by 2 and 3 columns). */
export const SET_CARDS_PAGE_SIZE = 36;

export async function getCardsInSetPage(
  setExternalId: string,
  opts: { limit?: number; cursor?: string | null } = {},
): Promise<{ cards: NormalizedCard[]; nextCursor: string | null }> {
  const limit = opts.limit ?? SET_CARDS_PAGE_SIZE;
  const cursor = opts.cursor ?? undefined;
  const res = await getRegistry().call(
    'catalog',
    'searchCards',
    (a) => a.searchCards({ query: '', setExternalId, limit, cursor }),
    {
      key: `catalog:set-cards:${setExternalId}:${cursor ?? 'start'}:${limit}`,
      ttlSeconds: 3600,
    },
  );
  const cards = res.cards.filter((c) => c.setExternalId === setExternalId);
  return { cards, nextCursor: res.nextCursor };
}

/** Load every card in a set by walking provider pages (prefer getCardsInSetPage for UI). */
export async function getCardsInSet(setExternalId: string): Promise<NormalizedCard[]> {
  const all: NormalizedCard[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 50; i++) {
    const page = await getCardsInSetPage(setExternalId, { limit: 100, cursor });
    all.push(...page.cards);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return all;
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
  // The app is USD-only: Cardmarket (EUR) values are converted at the ECB
  // reference rate and marked `fxConverted` for honest labeling.
  return { raw: await toUsdPrices(raw), graded: await toUsdPrices(graded) };
}

export async function getRawHistory(
  cardExternalId: string,
  days: number,
): Promise<NormalizedPricePoint[]> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const points = await getRegistry().call('rawPricing', 'getRawPriceHistory', (a) =>
    a.getRawPriceHistory({
      cardExternalId,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    }),
  );
  return toUsdPoints(points);
}

export async function getPopulation(
  cardExternalId: string,
  gradingCompany: GradingCompany = 'psa',
): Promise<NormalizedPopulationReport> {
  return getRegistry().call('population', 'getPopulation', (a) =>
    a.getPopulation({ cardExternalId, gradingCompany }),
  );
}
