import { describe, it, expect, vi } from 'vitest';
import { createPokemonTcgRawPricing, mapTcgPlayerFinish } from './pokemontcg-pricing';
import {
  createCatalogOcrRecognition,
  stringSimilarity,
} from './catalog-ocr-recognition';
import { demoProviderCapabilities } from './demo';
import { isProviderError } from '../errors';

// A realistic pokemontcg.io card response with embedded pricing.
const PTCG_CARD = {
  data: {
    id: 'base1-4',
    tcgplayer: {
      updatedAt: '2024/07/01',
      prices: {
        holofoil: { low: 250.0, mid: 320.5, high: 800.0, market: 350.25, directLow: 300 },
        reverseHolofoil: { low: 40, mid: 55, high: 90, market: 60 },
      },
    },
    cardmarket: {
      updatedAt: '2024/07/01',
      prices: { averageSellPrice: 300.5, lowPrice: 210.0, trendPrice: 330.0, avg1: 305, avg7: 290, avg30: 275 },
    },
  },
};

function mockFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  ) as unknown as typeof fetch;
}

describe('pokemontcg raw pricing adapter', () => {
  it('normalizes TCGplayer + Cardmarket prices to minor units and finishes', async () => {
    const adapter = createPokemonTcgRawPricing({ fetchImpl: mockFetch(PTCG_CARD) });
    const prices = await adapter.getCurrentRawPrices({ cardExternalId: 'base1-4' });

    const holo = prices.find((p) => p.market === 'tcgplayer' && p.finish === 'holo');
    expect(holo?.valueMinor).toBe(35025); // $350.25 → cents
    expect(holo?.currency).toBe('USD');
    expect(holo?.freshness).toBe('live');
    expect(holo?.lowMinor).toBe(25000);

    const cm = prices.find((p) => p.market === 'cardmarket');
    expect(cm?.currency).toBe('EUR');
    expect(cm?.valueMinor).toBe(30050);
  });

  it('filters by finish when requested', async () => {
    const adapter = createPokemonTcgRawPricing({ fetchImpl: mockFetch(PTCG_CARD) });
    const prices = await adapter.getCurrentRawPrices({ cardExternalId: 'base1-4', finish: 'reverse_holo' });
    expect(prices.some((p) => p.finish === 'reverse_holo')).toBe(true);
    expect(prices.some((p) => p.finish === 'holo')).toBe(false);
  });

  it('maps 429 to a retryable rate_limited ProviderError', async () => {
    const adapter = createPokemonTcgRawPricing({ fetchImpl: mockFetch({}, 429) });
    await adapter.getCurrentRawPrices({ cardExternalId: 'x' }).catch((e) => {
      expect(isProviderError(e)).toBe(true);
      if (isProviderError(e)) {
        expect(e.code).toBe('rate_limited');
        expect(e.retryable).toBe(true);
      }
    });
    expect.assertions(3);
  });

  it('builds a real sparse trend from Cardmarket rolling averages', async () => {
    const adapter = createPokemonTcgRawPricing({ fetchImpl: mockFetch(PTCG_CARD) });
    const hist = await adapter.getRawPriceHistory({
      cardExternalId: 'base1-4',
      from: '2000-01-01',
      to: '2100-01-01',
    });
    // 4 points: avg30, avg7, avg1, current — ascending, EUR, live, minor units.
    expect(hist.length).toBe(4);
    expect(hist[0]!.valueMinor).toBe(27500); // avg30 = €275
    expect(hist[hist.length - 1]!.valueMinor).toBe(30050); // current €300.50
    expect(hist.every((p) => p.currency === 'EUR' && p.freshness === 'live')).toBe(true);
    // Dates ascending.
    const dates = hist.map((p) => p.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('returns empty history when the card has no Cardmarket data', async () => {
    const noCm = { data: { id: 'x', tcgplayer: PTCG_CARD.data.tcgplayer } };
    const adapter = createPokemonTcgRawPricing({ fetchImpl: mockFetch(noCm) });
    const hist = await adapter.getRawPriceHistory({ cardExternalId: 'x', from: '2000-01-01', to: '2100-01-01' });
    expect(hist).toEqual([]);
  });

  it('maps printing keys to finishes', () => {
    expect(mapTcgPlayerFinish('holofoil')).toBe('holo');
    expect(mapTcgPlayerFinish('reverseHolofoil')).toBe('reverse_holo');
    expect(mapTcgPlayerFinish('1stEditionHolofoil')).toBe('first_edition');
    expect(mapTcgPlayerFinish('normal')).toBe('normal');
  });
});

describe('catalog-ocr recognition adapter', () => {
  const catalog = demoProviderCapabilities().catalog!;

  it('ranks candidates from OCR text and matches the number', async () => {
    const rec = createCatalogOcrRecognition(catalog);
    const result = await rec.identifyCard({
      imageRef: 'x',
      ocr: { name: 'Charizard', number: '4' },
    });
    expect(result.candidates[0]?.cardExternalId).toBe('base1-4');
    expect(result.candidates[0]?.evidence?.numberMatch).toBe(true);
  });

  it('requires confirmation for ambiguous look-alikes', async () => {
    const rec = createCatalogOcrRecognition(catalog);
    const result = await rec.identifyCard({ imageRef: 'x', ocr: { name: 'Pikachu' } });
    expect(result.requiresConfirmation).toBe(true);
  });

  it('throws when no OCR text is supplied (cannot identify blind)', async () => {
    const rec = createCatalogOcrRecognition(catalog);
    await expect(rec.identifyCard({ imageRef: 'x' })).rejects.toThrow(/OCR/i);
  });

  it('string similarity is 1 for identical and lower for different', () => {
    expect(stringSimilarity('Charizard', 'Charizard')).toBe(1);
    expect(stringSimilarity('Charizard', 'Charmander')).toBeLessThan(0.7);
    expect(stringSimilarity('Mew ex', 'Mew ex')).toBe(1);
  });
});
