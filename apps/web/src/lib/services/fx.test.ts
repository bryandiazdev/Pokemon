import { describe, expect, it } from 'vitest';
import { convertMinorToUsd, convertPriceToUsd } from './fx';
import type { NormalizedGradedPrice, NormalizedPrice } from '@psr/providers';

const eurPrice = (over: Partial<NormalizedPrice> = {}): NormalizedPrice => ({
  provider: 'tcgdex',
  market: 'cardmarket',
  currency: 'EUR',
  condition: 'near_mint',
  valueMinor: 1000,
  lowMinor: 800,
  highMinor: 1200,
  valuationType: 'market',
  recordedForDate: '2026-07-18',
  freshness: 'live',
  ...over,
});

describe('fx conversion', () => {
  it('converts EUR minor units at the given rate', () => {
    expect(convertMinorToUsd(1000, 'EUR', 1.1)).toBe(1100);
    expect(convertMinorToUsd(999, 'EUR', 1.0836)).toBe(1083); // rounds
  });

  it('converts value, low, and high and marks the price as converted', () => {
    const usd = convertPriceToUsd(eurPrice(), 1.1);
    expect(usd.currency).toBe('USD');
    expect(usd.valueMinor).toBe(1100);
    expect(usd.lowMinor).toBe(880);
    expect(usd.highMinor).toBe(1320);
    expect(usd.fxConverted).toEqual({ from: 'EUR', rate: 1.1 });
  });

  it('passes native USD prices through untouched', () => {
    const native = eurPrice({ currency: 'USD', market: 'tcgplayer' });
    const out = convertPriceToUsd(native, 1.1);
    expect(out).toBe(native);
    expect(out.fxConverted).toBeUndefined();
  });

  it('preserves graded-price fields through conversion', () => {
    const graded: NormalizedGradedPrice = {
      ...eurPrice(),
      gradingCompany: 'psa',
      grade: '10',
    };
    const out = convertPriceToUsd(graded, 1.08);
    expect(out.gradingCompany).toBe('psa');
    expect(out.grade).toBe('10');
    expect(out.currency).toBe('USD');
    expect(out.valueMinor).toBe(1080);
  });
});
