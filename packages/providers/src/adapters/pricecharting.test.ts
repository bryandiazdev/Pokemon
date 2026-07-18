import { describe, expect, it, vi } from 'vitest';
import { createPriceChartingGradedPricing } from './pricecharting';
import type { CardCatalogProvider, NormalizedCard, NormalizedSet } from '../interfaces';

const card: NormalizedCard = {
  externalId: 'base1-4',
  provider: 'tcgdex',
  setExternalId: 'base1',
  name: 'Charizard',
  number: '4',
  printedNumber: '4/102',
  rarity: 'Rare Holo',
  supertype: 'Pokémon',
  subtypes: [],
  language: 'en',
  artist: null,
  regulationMark: null,
  imageSmallUrl: null,
  imageLargeUrl: null,
};

const set: NormalizedSet = {
  externalId: 'base1',
  provider: 'tcgdex',
  name: 'Base Set',
  series: 'Base',
  language: 'en',
  printedTotal: 102,
  total: 102,
  releaseDate: '1999-01-09',
  symbolUrl: null,
  logoUrl: null,
};

const catalog: CardCatalogProvider = {
  name: 'test',
  async searchCards() {
    return { cards: [], nextCursor: null };
  },
  async getCard() {
    return card;
  },
  async getSet() {
    return set;
  },
  async listSets() {
    return [set];
  },
};

const PRODUCT = {
  status: 'success',
  id: '12345',
  'product-name': 'Charizard #4',
  'console-name': 'Pokemon Base Set',
  'loose-price': 20000,
  'cib-price': 40000,
  'new-price': 60000,
  'graded-price': 90000,
  'box-only-price': 150000,
  'manual-only-price': 500000,
  'bgs-10-price': 900000,
  'condition-17-price': 450000,
  'condition-18-price': 400000,
  'sales-volume': 321,
};

function fakeFetch(body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
}

const makeProvider = (fetchImpl: typeof fetch) =>
  createPriceChartingGradedPricing(catalog, {
    apiKey: 'x'.repeat(40),
    fetchImpl,
    throttleMs: 0,
  });

describe('pricecharting graded pricing', () => {
  it('maps penny fields to per-company graded prices', async () => {
    const provider = makeProvider(fakeFetch(PRODUCT) as unknown as typeof fetch);
    const prices = await provider.getCurrentGradedPrices({ cardExternalId: 'base1-4' });

    const by = (co: string, grade: string) =>
      prices.find((p) => p.gradingCompany === co && p.grade === grade);
    expect(by('psa', '10')?.valueMinor).toBe(500000);
    expect(by('bgs', '10')?.valueMinor).toBe(900000);
    expect(by('cgc', '10')?.valueMinor).toBe(450000);
    expect(by('sgc', '10')?.valueMinor).toBe(400000);
    expect(by('psa', '9')?.valueMinor).toBe(90000);
    expect(by('psa', '9')?.label).toContain('any grading co');
    expect(prices.every((p) => p.currency === 'USD' && p.freshness === 'live')).toBe(true);
  });

  it('filters by grading company when requested', async () => {
    const provider = makeProvider(fakeFetch(PRODUCT) as unknown as typeof fetch);
    const bgs = await provider.getCurrentGradedPrices({
      cardExternalId: 'base1-4',
      gradingCompany: 'bgs',
    });
    expect(bgs).toHaveLength(1);
    expect(bgs[0]?.grade).toBe('10');
  });

  it('caches lookups so repeated calls hit the API once', async () => {
    const impl = fakeFetch(PRODUCT);
    const provider = makeProvider(impl as unknown as typeof fetch);
    await provider.getCurrentGradedPrices({ cardExternalId: 'base1-4' });
    await provider.getCurrentGradedPrices({ cardExternalId: 'base1-4', gradingCompany: 'psa' });
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it('rejects an implausible best match instead of returning wrong prices', async () => {
    const wrong = { ...PRODUCT, 'product-name': 'Blastoise #2', 'console-name': 'Pokemon Base Set' };
    const provider = makeProvider(fakeFetch(wrong) as unknown as typeof fetch);
    await expect(
      provider.getCurrentGradedPrices({ cardExternalId: 'base1-4' }),
    ).rejects.toThrow(/No confident PriceCharting match/);
  });

  it('requires the collector number to appear in the product title', async () => {
    const wrongNumber = { ...PRODUCT, 'product-name': 'Charizard #44' };
    const provider = makeProvider(fakeFetch(wrongNumber) as unknown as typeof fetch);
    await expect(
      provider.getCurrentGradedPrices({ cardExternalId: 'base1-4' }),
    ).rejects.toThrow(/No confident PriceCharting match/);
  });

  it('returns empty graded history (unsupported by the API)', async () => {
    const provider = makeProvider(fakeFetch(PRODUCT) as unknown as typeof fetch);
    await expect(
      provider.getGradedPriceHistory({
        cardExternalId: 'base1-4',
        gradingCompany: 'psa',
        grade: '10',
        from: '2026-01-01',
        to: '2026-07-18',
      }),
    ).resolves.toEqual([]);
  });
});
