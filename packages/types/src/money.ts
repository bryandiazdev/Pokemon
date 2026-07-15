/**
 * Money handled as integer **minor units** (e.g. cents) — never floats.
 *
 * A `Money` value pairs an integer amount of minor units with an ISO-4217
 * currency code. Currencies have different minor-unit exponents (USD=2, JPY=0,
 * BHD=3), so formatting and parsing must be exponent-aware.
 */

export type CurrencyCode = string; // ISO-4217, e.g. "USD", "JPY"

export interface Money {
  /** Integer count of the currency's minor units (may be negative). */
  readonly minor: number;
  readonly currency: CurrencyCode;
}

/** Minor-unit exponent per currency. Defaults to 2 when not listed. */
const CURRENCY_EXPONENTS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  JPY: 0,
  KRW: 0,
  BHD: 3,
  KWD: 3,
  CLP: 0,
  ISK: 0,
};

export function currencyExponent(currency: CurrencyCode): number {
  return CURRENCY_EXPONENTS[currency.toUpperCase()] ?? 2;
}

export function money(minor: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(minor)) {
    throw new TypeError(`Money.minor must be an integer, got ${minor}`);
  }
  if (!/^[A-Za-z]{3}$/.test(currency)) {
    throw new TypeError(`Invalid currency code: ${currency}`);
  }
  return { minor, currency: currency.toUpperCase() };
}

export const zeroMoney = (currency: CurrencyCode): Money => money(0, currency);

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor + b.minor, a.currency);
}

export function subMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor - b.minor, a.currency);
}

/** Multiply by an integer quantity (e.g. unit price × count). */
export function mulMoney(a: Money, qty: number): Money {
  if (!Number.isInteger(qty)) {
    throw new TypeError(`Quantity must be an integer, got ${qty}`);
  }
  return money(a.minor * qty, a.currency);
}

/** Sum a list of Money; empty list requires an explicit currency. */
export function sumMoney(items: readonly Money[], currency?: CurrencyCode): Money {
  if (items.length === 0) {
    if (!currency) throw new Error('sumMoney of empty list requires a currency');
    return zeroMoney(currency);
  }
  return items.reduce((acc, m) => addMoney(acc, m));
}

/** Convert a decimal major-unit number (e.g. 4.99) to Money. Rounds half-up. */
export function fromMajor(major: number, currency: CurrencyCode): Money {
  const factor = 10 ** currencyExponent(currency);
  const minor = Math.round(major * factor + Number.EPSILON);
  return money(minor, currency);
}

/** Decimal major-unit representation (for display/formatting only). */
export function toMajor(m: Money): number {
  return m.minor / 10 ** currencyExponent(m.currency);
}

/**
 * Convert between currencies using a stored rate. The result records that a
 * conversion occurred — callers must never present the output as a native
 * market observation. Rate is major-per-major (e.g. USD→EUR 0.92).
 */
export function convertMoney(
  m: Money,
  toCurrency: CurrencyCode,
  rate: number,
): Money {
  if (rate <= 0 || !Number.isFinite(rate)) {
    throw new RangeError(`Invalid FX rate: ${rate}`);
  }
  const fromExp = currencyExponent(m.currency);
  const toExp = currencyExponent(toCurrency);
  const majorTarget = (m.minor / 10 ** fromExp) * rate;
  const minor = Math.round(majorTarget * 10 ** toExp + Number.EPSILON);
  return money(minor, toCurrency);
}

/** Locale-aware formatting via Intl. Falls back to a plain string. */
export function formatMoney(m: Money, locale = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: m.currency,
      minimumFractionDigits: currencyExponent(m.currency),
      maximumFractionDigits: currencyExponent(m.currency),
    }).format(toMajor(m));
  } catch {
    return `${toMajor(m).toFixed(currencyExponent(m.currency))} ${m.currency}`;
  }
}

export function isNegative(m: Money): boolean {
  return m.minor < 0;
}

/** Signed percentage change between two amounts (same currency). null if base is 0. */
export function pctChange(from: Money, to: Money): number | null {
  assertSameCurrency(from, to);
  if (from.minor === 0) return null;
  return ((to.minor - from.minor) / Math.abs(from.minor)) * 100;
}
