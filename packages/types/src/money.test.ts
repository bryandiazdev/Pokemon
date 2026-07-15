import { describe, it, expect } from 'vitest';
import {
  money,
  fromMajor,
  toMajor,
  addMoney,
  subMoney,
  mulMoney,
  sumMoney,
  convertMoney,
  pctChange,
  currencyExponent,
  formatMoney,
} from './money';

describe('money', () => {
  it('rejects non-integer minor units', () => {
    expect(() => money(1.5, 'USD')).toThrow();
  });

  it('handles currencies without 2 decimals', () => {
    expect(currencyExponent('JPY')).toBe(0);
    expect(currencyExponent('BHD')).toBe(3);
    expect(fromMajor(500, 'JPY').minor).toBe(500);
    expect(fromMajor(4.99, 'USD').minor).toBe(499);
  });

  it('adds, subtracts, multiplies without float drift', () => {
    const a = fromMajor(0.1, 'USD');
    const b = fromMajor(0.2, 'USD');
    expect(addMoney(a, b).minor).toBe(30); // no 0.30000000004
    expect(subMoney(b, a).minor).toBe(10);
    expect(mulMoney(a, 3).minor).toBe(30);
    expect(toMajor(addMoney(a, b))).toBeCloseTo(0.3);
  });

  it('throws on currency mismatch', () => {
    expect(() => addMoney(money(1, 'USD'), money(1, 'EUR'))).toThrow();
  });

  it('sums a list', () => {
    expect(sumMoney([fromMajor(1, 'USD'), fromMajor(2, 'USD')]).minor).toBe(300);
    expect(sumMoney([], 'USD').minor).toBe(0);
    expect(() => sumMoney([])).toThrow();
  });

  it('converts currency and rounds to target exponent', () => {
    const usd = fromMajor(10, 'USD');
    const jpy = convertMoney(usd, 'JPY', 150);
    expect(jpy.currency).toBe('JPY');
    expect(jpy.minor).toBe(1500);
  });

  it('computes percentage change', () => {
    expect(pctChange(fromMajor(100, 'USD'), fromMajor(150, 'USD'))).toBeCloseTo(50);
    expect(pctChange(fromMajor(0, 'USD'), fromMajor(1, 'USD'))).toBeNull();
  });

  it('formats money', () => {
    expect(formatMoney(fromMajor(4.99, 'USD'))).toContain('4.99');
  });
});
