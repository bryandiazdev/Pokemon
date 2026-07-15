/**
 * Pokémon TCG API raw-pricing adapter.
 *
 * The pokemontcg.io card object embeds TCGplayer (USD) and Cardmarket (EUR)
 * price snapshots. This adapter normalizes them into `NormalizedPrice[]`. It is
 * a legitimate use of the licensed data the API exposes — NOT scraping.
 *
 * History is intentionally NOT provided here: this API returns only current
 * snapshots. Historical charts are built from our own daily `price_points`
 * snapshots (see the price-snapshot background job), so `getRawPriceHistory`
 * returns an empty series and callers fall back to stored data.
 *
 * Not affiliated with or endorsed by pokemontcg.io, TCGplayer, or Cardmarket.
 */

import type {
  RawPricingProvider,
  PricingInput,
  PriceHistoryInput,
  NormalizedPrice,
  NormalizedPricePoint,
} from '../interfaces';
import type { CardFinish } from '@psr/types';
import { ProviderError } from '../errors';

const NAME = 'pokemontcg';
const BASE = 'https://api.pokemontcg.io/v2';

interface TcgPlayerPriceBlock {
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  market?: number | null;
  directLow?: number | null;
}
interface PtcgPricingCard {
  id: string;
  tcgplayer?: {
    updatedAt?: string;
    prices?: Record<string, TcgPlayerPriceBlock>;
  };
  cardmarket?: {
    updatedAt?: string;
    prices?: {
      averageSellPrice?: number | null;
      lowPrice?: number | null;
      trendPrice?: number | null;
      avg1?: number | null;
      avg7?: number | null;
      avg30?: number | null;
    };
  };
}

export interface PokemonTcgPricingOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

/** Map a TCGplayer printing key to our normalized finish. */
export function mapTcgPlayerFinish(key: string): CardFinish {
  const k = key.toLowerCase();
  if (k.includes('reverse')) return 'reverse_holo';
  if (k.includes('1steditionholofoil') || k.includes('1stedition')) return 'first_edition';
  if (k.includes('holofoil') || k.includes('holo')) return 'holo';
  if (k.includes('normal')) return 'normal';
  return 'other';
}

const toMinor = (value: number): number => Math.round(value * 100);

export function createPokemonTcgRawPricing(
  opts: PokemonTcgPricingOptions = {},
): RawPricingProvider {
  const doFetch = opts.fetchImpl ?? fetch;

  async function fetchCard(externalId: string, signal?: AbortSignal): Promise<PtcgPricingCard> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.apiKey) headers['X-Api-Key'] = opts.apiKey;
    let res: Response;
    try {
      res = await doFetch(`${BASE}/cards/${encodeURIComponent(externalId)}`, { headers, signal });
    } catch (cause) {
      throw new ProviderError('unavailable', NAME, 'Network error', { retryable: true, cause });
    }
    if (res.status === 429) {
      throw new ProviderError('rate_limited', NAME, 'Rate limited', { status: 429, retryable: true });
    }
    if (res.status === 404) {
      throw new ProviderError('not_found', NAME, `Card ${externalId} not found`, { status: 404 });
    }
    if (!res.ok) {
      throw new ProviderError('bad_response', NAME, `HTTP ${res.status}`, {
        status: res.status,
        retryable: res.status >= 500,
      });
    }
    const body = (await res.json()) as { data: PtcgPricingCard };
    return body.data;
  }

  function normalize(card: PtcgPricingCard): NormalizedPrice[] {
    const out: NormalizedPrice[] = [];
    const today = new Date().toISOString().slice(0, 10);

    // TCGplayer (USD), by printing. These are effectively Near Mint market prices.
    const tp = card.tcgplayer;
    if (tp?.prices) {
      for (const [printing, block] of Object.entries(tp.prices)) {
        const market = block.market ?? block.mid ?? block.low;
        if (market == null) continue;
        out.push({
          provider: NAME,
          market: 'tcgplayer',
          currency: 'USD',
          condition: 'near_mint',
          finish: mapTcgPlayerFinish(printing),
          valueMinor: toMinor(market),
          lowMinor: block.low != null ? toMinor(block.low) : undefined,
          highMinor: block.high != null ? toMinor(block.high) : undefined,
          valuationType: 'market',
          recordedForDate: today,
          providerUpdatedAt: tp.updatedAt,
          freshness: 'live',
        });
      }
    }

    // Cardmarket (EUR). averageSellPrice ≈ market; preserve native currency.
    const cm = card.cardmarket;
    if (cm?.prices) {
      const market = cm.prices.averageSellPrice ?? cm.prices.trendPrice;
      if (market != null) {
        out.push({
          provider: NAME,
          market: 'cardmarket',
          currency: 'EUR',
          condition: 'near_mint',
          valueMinor: toMinor(market),
          lowMinor: cm.prices.lowPrice != null ? toMinor(cm.prices.lowPrice) : undefined,
          highMinor: cm.prices.trendPrice != null ? toMinor(cm.prices.trendPrice) : undefined,
          valuationType: 'market',
          recordedForDate: today,
          providerUpdatedAt: cm.updatedAt,
          freshness: 'live',
        });
      }
    }

    if (out.length === 0) {
      throw new ProviderError('not_found', NAME, `No pricing available for ${card.id}`);
    }
    return out;
  }

  return {
    name: NAME,
    async getCurrentRawPrices(input: PricingInput): Promise<NormalizedPrice[]> {
      const card = await fetchCard(input.cardExternalId);
      const prices = normalize(card);
      return input.finish ? prices.filter((p) => !p.finish || p.finish === input.finish) : prices;
    },
    async getRawPriceHistory(input: PriceHistoryInput): Promise<NormalizedPricePoint[]> {
      // The API has no daily history endpoint, but the Cardmarket block carries
      // genuine rolling averages (1/7/30-day) + current. We surface those as a
      // small, HONEST trend (real provider data, not interpolation). Dense daily
      // history still accumulates via our own price_points snapshots over time.
      const card = await fetchCard(input.cardExternalId);
      const cm = card.cardmarket?.prices;
      if (!cm) return [];
      const dayMs = 86_400_000;
      const now = Date.now();
      const raw: Array<{ offsetDays: number; value: number | null | undefined }> = [
        { offsetDays: 30, value: cm.avg30 },
        { offsetDays: 7, value: cm.avg7 },
        { offsetDays: 1, value: cm.avg1 },
        { offsetDays: 0, value: cm.averageSellPrice ?? cm.trendPrice },
      ];
      const fromMs = input.from ? new Date(input.from).getTime() : 0;
      const points: NormalizedPricePoint[] = [];
      for (const { offsetDays, value } of raw) {
        if (value == null) continue;
        const ts = now - offsetDays * dayMs;
        if (ts < fromMs) continue;
        points.push({
          date: new Date(ts).toISOString().slice(0, 10),
          valueMinor: toMinor(value),
          currency: 'EUR',
          freshness: 'live',
        });
      }
      // De-dupe identical dates, keep ascending order.
      const seen = new Set<string>();
      return points.filter((p) => (seen.has(p.date) ? false : (seen.add(p.date), true)));
    },
  };
}
