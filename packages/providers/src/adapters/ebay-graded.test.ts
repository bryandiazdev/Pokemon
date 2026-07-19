import { describe, it, expect, vi } from 'vitest';
import { createEbayGradedPricing, parseGradeFromTitle, cleanAsks } from './ebay-graded';
import type { CardCatalogProvider, NormalizedCard, NormalizedSet } from '../interfaces';

const CARD: NormalizedCard = {
  externalId: 'base1-4',
  setExternalId: 'base1',
  name: 'Charizard',
  number: '4',
  printedNumber: '4/102',
  language: 'en',
  rarity: 'Rare',
  imageSmallUrl: null,
  imageLargeUrl: null,
  artist: null,
  regulationMark: null,
  supertype: 'Pokémon',
  subtypes: [],
  provider: 'tcgdex',
  metadata: {},
};

const catalog: CardCatalogProvider = {
  name: 'test-catalog',
  async getCard() {
    return CARD;
  },
  async getSet() {
    return { externalId: 'base1', name: 'Base Set', provider: 'tcgdex' } as NormalizedSet;
  },
  async searchCards() {
    return { cards: [], nextCursor: null };
  },
  async listSets() {
    return [];
  },
};

function tokenResponse() {
  return new Response(JSON.stringify({ access_token: 'tok', expires_in: 7200 }), { status: 200 });
}

function searchResponse(items: Array<{ title: string; value: string; currency?: string }>) {
  return new Response(
    JSON.stringify({
      itemSummaries: items.map((i) => ({
        title: i.title,
        price: { value: i.value, currency: i.currency ?? 'USD' },
      })),
    }),
    { status: 200 },
  );
}

describe('parseGradeFromTitle', () => {
  it('reads company + grade across phrasings', () => {
    expect(parseGradeFromTitle('Charizard Base Set PSA 10 GEM MINT')).toEqual({
      company: 'psa',
      grade: '10',
    });
    expect(parseGradeFromTitle('Charizard BGS-9.5 Quad')).toEqual({ company: 'bgs', grade: '9.5' });
    expect(parseGradeFromTitle('CGC Pristine 10 Charizard')).toEqual({
      company: 'cgc',
      grade: '10',
    });
    expect(parseGradeFromTitle('Beckett 9.5 Charizard Holo')).toEqual({
      company: 'bgs',
      grade: '9.5',
    });
    expect(parseGradeFromTitle('Charizard Holo Near Mint raw')).toBeNull();
  });
});

describe('cleanAsks', () => {
  it('drops scam-cheap and delusional outliers', () => {
    const cleaned = cleanAsks([100, 9000, 10000, 11000, 90000]);
    expect(cleaned).toEqual([9000, 10000, 11000]);
  });
});

describe('eBay graded pricing adapter', () => {
  it('authenticates, buckets by parsed grade, and prices from the ask distribution', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      calls.push(u);
      if (u.includes('oauth2/token')) return tokenResponse();
      if (u.includes('q=Charizard+Base+Set+4+PSA')) {
        return searchResponse([
          { title: 'Charizard Base Set 4/102 PSA 10 GEM', value: '1500.00' },
          { title: 'Charizard Base Set 4/102 PSA 10', value: '1400.00' },
          { title: 'Charizard 4/102 PSA 10 Holo', value: '1650.00' },
          { title: 'Charizard Base Set PSA 9 MINT', value: '520.00' },
          { title: 'Charizard PROXY PSA 10 replica', value: '20.00' }, // excluded
          { title: 'Blastoise Base Set PSA 10', value: '900.00' }, // wrong card
          { title: 'Charizard Base Set CGC 10', value: '800.00' }, // wrong company for this query
        ]);
      }
      return searchResponse([]);
    }) as unknown as typeof fetch;

    const provider = createEbayGradedPricing(catalog, {
      clientId: 'id',
      clientSecret: 'secret',
      fetchImpl,
    });
    const prices = await provider.getCurrentGradedPrices({
      cardExternalId: 'base1-4',
      gradingCompany: 'psa',
    });

    expect(prices).toHaveLength(2);
    const psa10 = prices.find((p) => p.grade === '10')!;
    expect(psa10.gradingCompany).toBe('psa');
    // Asks [1400, 1500, 1650] → lower quartile 1400, low 1400, high(median) 1500.
    expect(psa10.valueMinor).toBe(140000);
    expect(psa10.lowMinor).toBe(140000);
    expect(psa10.highMinor).toBe(150000);
    expect(psa10.sampleSize).toBe(3);
    expect(psa10.market).toBe('ebay-asks');
    expect(psa10.freshness).toBe('live');

    const psa9 = prices.find((p) => p.grade === '9')!;
    expect(psa9.valueMinor).toBe(52000);
  });

  it('caches per card+company so repeat calls do not re-hit eBay', async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('oauth2/token')) return tokenResponse();
      return searchResponse([{ title: 'Charizard PSA 10', value: '1000.00' }]);
    }) as unknown as typeof fetch;

    const provider = createEbayGradedPricing(catalog, {
      clientId: 'id',
      clientSecret: 'secret',
      fetchImpl,
    });
    await provider.getCurrentGradedPrices({ cardExternalId: 'base1-4', gradingCompany: 'psa' });
    const before = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls.length;
    await provider.getCurrentGradedPrices({ cardExternalId: 'base1-4', gradingCompany: 'psa' });
    expect((fetchImpl as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before);
  });

  it('one failing company does not empty the whole result', async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('oauth2/token')) return tokenResponse();
      if (u.includes('PSA')) return searchResponse([{ title: 'Charizard PSA 10', value: '1000.00' }]);
      return new Response('teapot', { status: 418 });
    }) as unknown as typeof fetch;

    const provider = createEbayGradedPricing(catalog, {
      clientId: 'id',
      clientSecret: 'secret',
      fetchImpl,
    });
    const prices = await provider.getCurrentGradedPrices({ cardExternalId: 'base1-4' });
    expect(prices.some((p) => p.gradingCompany === 'psa')).toBe(true);
  });
});
