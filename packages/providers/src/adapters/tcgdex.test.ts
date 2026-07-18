import { describe, it, expect, vi } from 'vitest';
import { createTcgdexCatalog, createTcgdexRawPricing } from './tcgdex';
import { isProviderError } from '../errors';

const CARD_FULL = {
  id: 'base1-4',
  localId: '4',
  name: 'Charizard',
  image: 'https://assets.tcgdex.net/en/base/base1/4',
  rarity: 'Rare',
  category: 'Pokemon',
  illustrator: 'Mitsuhiro Arita',
  set: { id: 'base1', name: 'Base Set', cardCount: { official: 102, total: 102 } },
  pricing: {
    tcgplayer: {
      unit: 'USD',
      updated: '2026-07-15T18:04:05.969Z',
      holofoil: { lowPrice: 510, midPrice: 709.99, highPrice: 1500, marketPrice: 773.51, directLowPrice: 633.44 },
    },
    cardmarket: {
      unit: 'EUR',
      updated: '2026-07-15T18:04:08.251Z',
      avg: 698.29,
      low: 100,
      trend: 480.49,
      avg1: 849.99,
      avg7: 378.57,
      avg30: 475.91,
    },
  },
};

const SETS = [
  { id: 'base1', name: 'Base Set', logo: 'https://assets.tcgdex.net/en/base/base1/logo', cardCount: { total: 102, official: 102 } },
  { id: 'sv04.5', name: 'Paldean Fates', cardCount: { total: 245, official: 91 } },
];

const SEARCH = [
  { id: 'base1-4', localId: '4', name: 'Charizard', image: 'https://assets.tcgdex.net/en/base/base1/4' },
  { id: 'base4-4', localId: '4', name: 'Charizard', image: 'https://assets.tcgdex.net/en/base/base4/4' },
];

function routingFetch(): typeof fetch {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    const body = u.includes('/cards/base1-4')
      ? CARD_FULL
      : u.includes('/sets/base1')
        ? { ...SETS[0], releaseDate: '1999-01-09', serie: { id: 'base', name: 'Base' }, cards: [] }
        : u.includes('/sets')
          ? SETS
          : u.includes('/cards?')
            ? SEARCH
            : {};
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
}

describe('tcgdex catalog adapter (keyless)', () => {
  it('lists sets with card counts', async () => {
    const cat = createTcgdexCatalog({ fetchImpl: routingFetch() });
    const sets = await cat.listSets({});
    expect(sets).toHaveLength(2);
    expect(sets[0]).toMatchObject({ externalId: 'base1', name: 'Base Set', total: 102, printedTotal: 102 });
    expect(sets[0]!.provider).toBe('tcgdex');
  });

  it('normalizes a full card incl. built image URLs and printed number', async () => {
    const cat = createTcgdexCatalog({ fetchImpl: routingFetch() });
    const card = await cat.getCard('base1-4');
    expect(card).toMatchObject({
      externalId: 'base1-4',
      setExternalId: 'base1',
      name: 'Charizard',
      number: '4',
      printedNumber: '4/102',
      artist: 'Mitsuhiro Arita',
    });
    expect(card.imageLargeUrl).toBe('https://assets.tcgdex.net/en/base/base1/4/high.webp');
    expect(card.imageSmallUrl).toBe('https://assets.tcgdex.net/en/base/base1/4/low.webp');
  });

  it('searches by name and filters by collector number ("Charizard 4")', async () => {
    const cat = createTcgdexCatalog({ fetchImpl: routingFetch() });
    const res = await cat.searchCards({ query: 'Charizard 4' });
    // Both results are localId 4, so both survive the number filter; setId derives from id.
    expect(res.cards.map((c) => c.setExternalId).sort()).toEqual(['base1', 'base4']);
  });

  it('splits letter-prefixed collector numbers ("Meloetta ex RC25")', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      return new Response(
        JSON.stringify([
          { id: 'g1-RC25', localId: 'RC25', name: 'Meloetta-EX' },
          { id: 'g1-RC26', localId: 'RC26', name: 'Meloetta-EX' },
        ]),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const cat = createTcgdexCatalog({ fetchImpl });
    const res = await cat.searchCards({ query: 'Meloetta ex RC25' });

    // The name filter keeps the full name; RC25 becomes the number filter.
    expect(calls[0]).toContain('name=Meloetta+ex');
    expect(res.cards).toHaveLength(1);
    expect(res.cards[0]).toMatchObject({ externalId: 'g1-RC25', number: 'RC25' });
  });

  it('does not eat trailing name words without digits ("Meloetta ex")', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;

    const cat = createTcgdexCatalog({ fetchImpl });
    await cat.searchCards({ query: 'Meloetta ex' });
    expect(calls[0]).toContain('name=Meloetta+ex');
  });

  it('zero-strips the number filter ("RC05" matches localId RC5)', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify([{ id: 'g1-RC5', localId: 'RC5', name: 'Meloetta-EX' }]),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
    const cat = createTcgdexCatalog({ fetchImpl });
    const res = await cat.searchCards({ query: 'Meloetta RC05' });
    expect(res.cards).toHaveLength(1);
    expect(res.cards[0]!.externalId).toBe('g1-RC5');
  });
});

describe('tcgdex raw pricing adapter', () => {
  it('normalizes TCGplayer (USD) + Cardmarket (EUR) to minor units', async () => {
    const pricing = createTcgdexRawPricing({ fetchImpl: routingFetch() });
    const prices = await pricing.getCurrentRawPrices({ cardExternalId: 'base1-4' });

    const holo = prices.find((p) => p.market === 'tcgplayer' && p.finish === 'holo');
    expect(holo?.valueMinor).toBe(77351); // $773.51
    expect(holo?.currency).toBe('USD');
    expect(holo?.freshness).toBe('live');

    const cm = prices.find((p) => p.market === 'cardmarket');
    expect(cm?.currency).toBe('EUR');
    expect(cm?.valueMinor).toBe(69829); // €698.29 avg
  });

  it('builds a real sparse trend from Cardmarket rolling averages', async () => {
    const pricing = createTcgdexRawPricing({ fetchImpl: routingFetch() });
    const hist = await pricing.getRawPriceHistory({ cardExternalId: 'base1-4', from: '2000-01-01', to: '2100-01-01' });
    expect(hist.length).toBe(4);
    expect(hist[0]!.valueMinor).toBe(47591); // avg30 €475.91
    expect(hist[hist.length - 1]!.valueMinor).toBe(69829); // current avg
    expect(hist.every((p) => p.currency === 'EUR' && p.freshness === 'live')).toBe(true);
  });

  it('throws not_found when a card has no pricing', async () => {
    const fetchNoPricing = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'x', name: 'X' }), { status: 200 }),
    ) as unknown as typeof fetch;
    const pricing = createTcgdexRawPricing({ fetchImpl: fetchNoPricing });
    await pricing.getCurrentRawPrices({ cardExternalId: 'x' }).catch((e) => {
      expect(isProviderError(e)).toBe(true);
    });
    expect.assertions(1);
  });
});
