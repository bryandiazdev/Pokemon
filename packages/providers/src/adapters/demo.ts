/** Demo/fixture adapters — implement every capability with no external calls. */

import type {
  CardCatalogProvider,
  CardRecognitionProvider,
  RawPricingProvider,
  GradedPricingProvider,
  PopulationProvider,
  CertificationProvider,
  MarketplaceProvider,
  ProviderCapabilities,
  NormalizedCard,
  NormalizedSet,
} from '../interfaces';
import { ProviderError } from '../errors';
import { DEMO_CARDS, DEMO_SETS } from '../fixtures/data';
import { demoGradedPrices, demoHistory, demoRawPrices } from '../fixtures/prices';

const NAME = 'demo';
const today = () => new Date().toISOString().slice(0, 10);

function findCard(externalId: string): NormalizedCard {
  const c = DEMO_CARDS.find((x) => x.externalId === externalId);
  if (!c) throw new ProviderError('not_found', NAME, `Demo card ${externalId} not found`);
  return c;
}
function findSet(externalId: string): NormalizedSet {
  const s = DEMO_SETS.find((x) => x.externalId === externalId);
  if (!s) throw new ProviderError('not_found', NAME, `Demo set ${externalId} not found`);
  return s;
}

/** Very light fuzzy matcher for demo search. */
function scoreMatch(card: NormalizedCard, q: string): number {
  const query = q.toLowerCase().trim();
  if (!query) return 0.1;
  const setName = DEMO_SETS.find((s) => s.externalId === card.setExternalId)?.name ?? '';
  const hay =
    `${card.name} ${card.number} ${card.printedNumber ?? ''} ${card.rarity ?? ''} ${setName}`.toLowerCase();
  let score = 0;
  if (hay.includes(query)) score += 1;
  for (const term of query.split(/\s+/)) {
    if (hay.includes(term)) score += 0.4;
    if (card.number === term || card.printedNumber === term) score += 0.8;
  }
  return score;
}

const catalog: CardCatalogProvider = {
  name: NAME,
  async searchCards({ query, limit = 20 }) {
    const cards = DEMO_CARDS.map((c) => ({ c, s: scoreMatch(c, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((x) => x.c);
    return { cards, nextCursor: null };
  },
  async getCard(externalId) {
    return findCard(externalId);
  },
  async getSet(externalId) {
    return findSet(externalId);
  },
  async listSets() {
    return DEMO_SETS;
  },
};

const recognition: CardRecognitionProvider = {
  name: NAME,
  async identifyCard() {
    // Demo recognition returns ranked candidates and requires confirmation
    // (never silently auto-selects among visually similar printings).
    const top = DEMO_CARDS.slice(0, 4).map((c, i) => ({
      cardExternalId: c.externalId,
      cardName: c.name,
      setHint: c.setExternalId,
      numberHint: c.number,
      language: c.language,
      confidence: 0.6 - i * 0.12,
      ranking: i + 1,
      evidence: { demo: true },
    }));
    return { candidates: top, provider: NAME, requiresConfirmation: true };
  },
};

const rawPricing: RawPricingProvider = {
  name: NAME,
  async getCurrentRawPrices({ cardExternalId }) {
    return demoRawPrices(cardExternalId, today());
  },
  async getRawPriceHistory({ cardExternalId, from, to }) {
    return demoHistory(cardExternalId, from, to);
  },
};

const gradedPricing: GradedPricingProvider = {
  name: NAME,
  async getCurrentGradedPrices({ cardExternalId, gradingCompany }) {
    const all = demoGradedPrices(cardExternalId, today());
    return gradingCompany ? all.filter((p) => p.gradingCompany === gradingCompany) : all;
  },
  async getGradedPriceHistory({ cardExternalId, from, to, gradingCompany, grade }) {
    return demoHistory(cardExternalId, from, to, { company: gradingCompany, grade });
  },
};

const population: PopulationProvider = {
  name: NAME,
  async getPopulation({ cardExternalId, gradingCompany }) {
    const seed = cardExternalId.length * 137;
    const byGrade = {
      '10': 1200 + (seed % 400),
      '9': 3400 + (seed % 800),
      '8': 900 + (seed % 300),
      '7': 350,
    };
    const total = Object.values(byGrade).reduce((a, b) => a + b, 0);
    return {
      gradingCompany,
      total,
      byGrade,
      gemRate: byGrade['10'] / total,
      asOf: today(),
      provider: NAME,
    };
  },
};

const certification: CertificationProvider = {
  name: NAME,
  async verifyCertification({ gradingCompany, certificationNumber }) {
    // Demo: certs starting with "0" are treated as not found.
    const found = !certificationNumber.startsWith('0');
    return {
      found,
      gradingCompany: found ? gradingCompany : undefined,
      grade: found ? '10' : undefined,
      certificationNumber,
      cardName: found ? 'Charizard — Base Set (demo)' : undefined,
      verifiedAt: new Date().toISOString(),
      provider: NAME,
    };
  },
};

const activeListings: MarketplaceProvider = {
  name: NAME,
  async getActiveListings({ cardExternalId, query, limit = 5 }) {
    const label = cardExternalId ?? query ?? 'demo';
    return Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
      provider: NAME,
      marketplace: 'demo-marketplace',
      title: `Demo active listing #${i + 1} for ${label}`,
      priceMinor: 10000 + i * 2500,
      currency: 'USD',
      url: 'https://example.com/demo-listing',
      condition: 'Near Mint',
      listingType: 'active_listing' as const,
      observedAt: new Date().toISOString(),
    }));
  },
};

export function demoProviderCapabilities(): ProviderCapabilities {
  return {
    catalog,
    recognition,
    rawPricing,
    gradedPricing,
    population,
    certification,
    activeListings,
  };
}
