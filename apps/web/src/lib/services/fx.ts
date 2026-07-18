import 'server-only';
import { convertMoney, money } from '@psr/types';
import type { NormalizedPrice, NormalizedPricePoint } from '@psr/providers';

/**
 * USD normalization for provider prices. TCGdex carries Cardmarket prices in
 * EUR; the app displays and sums everything in USD (mixed-currency money math
 * throws by design). EUR values are converted at the live ECB reference rate
 * (cached, keyless via frankfurter.app) with a static fallback so pricing
 * still works offline. Converted prices are marked `fxConverted` so the UI
 * can label them as approximations.
 */

/** Static fallback when the rate service is unreachable. Approximate. */
const FALLBACK_USD_RATES: Record<string, number> = {
  EUR: 1.08,
  GBP: 1.27,
};

const RATE_TTL_MS = 12 * 60 * 60 * 1000;
const rateCache = new Map<string, { at: number; rate: number }>();

/** EUR→USD (etc.) reference rate, cached ~12h. Never throws. */
export async function usdRate(fromCurrency: string): Promise<number> {
  const cur = fromCurrency.toUpperCase();
  if (cur === 'USD') return 1;

  const hit = rateCache.get(cur);
  if (hit && Date.now() - hit.at < RATE_TTL_MS) return hit.rate;

  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(cur)}&to=USD`,
      { signal: AbortSignal.timeout(5_000), next: { revalidate: 43_200 } },
    );
    if (res.ok) {
      const body = (await res.json()) as { rates?: { USD?: number } };
      const rate = body.rates?.USD;
      if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
        rateCache.set(cur, { at: Date.now(), rate });
        return rate;
      }
    }
  } catch {
    // fall through to the static rate
  }

  const fallback = FALLBACK_USD_RATES[cur];
  if (fallback) return fallback;
  // Unknown currency: value-preserving is impossible; log and pass through 1:1.
  // eslint-disable-next-line no-console
  console.warn(`[fx] no USD rate for ${cur}; passing values through unconverted`);
  return 1;
}

/** Convert integer minor units between currencies at the given rate. */
export function convertMinorToUsd(minor: number, fromCurrency: string, rate: number): number {
  return convertMoney(money(minor, fromCurrency), 'USD', rate).minor;
}

/** Pure conversion of one price (exported for tests). */
export function convertPriceToUsd<T extends NormalizedPrice>(p: T, rate: number): T {
  if (p.currency === 'USD') return p;
  return {
    ...p,
    currency: 'USD',
    valueMinor: convertMinorToUsd(p.valueMinor, p.currency, rate),
    lowMinor: p.lowMinor != null ? convertMinorToUsd(p.lowMinor, p.currency, rate) : undefined,
    highMinor: p.highMinor != null ? convertMinorToUsd(p.highMinor, p.currency, rate) : undefined,
    fxConverted: { from: p.currency, rate },
  };
}

/** Convert a batch of prices to USD. */
export async function toUsdPrices<T extends NormalizedPrice>(prices: T[]): Promise<T[]> {
  const out: T[] = [];
  for (const p of prices) {
    out.push(p.currency === 'USD' ? p : convertPriceToUsd(p, await usdRate(p.currency)));
  }
  return out;
}

/** Convert history points to USD. */
export async function toUsdPoints(points: NormalizedPricePoint[]): Promise<NormalizedPricePoint[]> {
  const out: NormalizedPricePoint[] = [];
  for (const pt of points) {
    if (pt.currency === 'USD') {
      out.push(pt);
    } else {
      const rate = await usdRate(pt.currency);
      out.push({
        ...pt,
        currency: 'USD',
        valueMinor: convertMinorToUsd(pt.valueMinor, pt.currency, rate),
      });
    }
  }
  return out;
}
