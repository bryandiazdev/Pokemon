/**
 * TCGdex adapter (https://tcgdex.dev) — catalog + raw pricing.
 *
 * TCGdex is a free, open, KEYLESS API: multilingual Pokémon card + set data,
 * card images, and market pricing sourced from TCGplayer (USD) and Cardmarket
 * (EUR), embedded directly in the card object. This makes it an excellent
 * no-cost replacement for paid catalog/pricing providers.
 *
 * Not affiliated with or endorsed by TCGdex, TCGplayer, Cardmarket, or The
 * Pokémon Company. Pricing is presented with honest freshness labeling; asking/
 * market snapshots are never relabeled as completed sales.
 */

import type {
  CardCatalogProvider,
  RawPricingProvider,
  CardSearchInput,
  CardSearchResult,
  NormalizedCard,
  NormalizedSet,
  NormalizedPrice,
  NormalizedPricePoint,
  SetSearchInput,
  PricingInput,
  PriceHistoryInput,
} from '../interfaces';
import type { CardFinish, Language } from '@psr/types';
import { ProviderError } from '../errors';
import { mapTcgPlayerFinish } from './pokemontcg-pricing';

const NAME = 'tcgdex';
const BASE = 'https://api.tcgdex.net/v2';

// ---------- API response shapes (subset we use) ----------

interface TcgdexSetBrief {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount?: { total?: number; official?: number };
}
interface TcgdexSetFull extends TcgdexSetBrief {
  releaseDate?: string;
  serie?: { id: string; name: string };
  cards?: TcgdexCardBrief[];
}
interface TcgdexCardBrief {
  id: string;
  localId?: string;
  name: string;
  image?: string;
}
interface TcgdexTcgPlayerBlock {
  lowPrice?: number | null;
  midPrice?: number | null;
  highPrice?: number | null;
  marketPrice?: number | null;
  directLowPrice?: number | null;
}
interface TcgdexCardFull extends TcgdexCardBrief {
  rarity?: string;
  category?: string;
  illustrator?: string;
  regulationMark?: string;
  set?: TcgdexSetBrief;
  pricing?: {
    tcgplayer?: { unit?: string; updated?: string } & Record<string, TcgdexTcgPlayerBlock | string | undefined>;
    cardmarket?: {
      unit?: string;
      updated?: string;
      avg?: number | null;
      low?: number | null;
      trend?: number | null;
      avg1?: number | null;
      avg7?: number | null;
      avg30?: number | null;
    };
  };
}

export interface TcgdexAdapterOptions {
  fetchImpl?: typeof fetch;
  /** Default catalog language for list/search (per-card language honored too). */
  language?: Language;
}

const toMinor = (value: number): number => Math.round(value * 100);

/** TCGdex `image` is a base URL; append quality + extension for a real asset. */
function imageUrl(base: string | undefined, quality: 'high' | 'low'): string | null {
  if (!base) return null;
  return `${base}/${quality}.webp`;
}

/** Derive the set id from a card id (`base1-4` → `base1`), last hyphen split. */
function setIdFromCardId(cardId: string): string {
  const idx = cardId.lastIndexOf('-');
  return idx > 0 ? cardId.slice(0, idx) : cardId;
}

function makeRequest(doFetch: typeof fetch) {
  return async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
    let res: Response;
    try {
      res = await doFetch(`${BASE}${path}`, { headers: { Accept: 'application/json' }, signal });
    } catch (cause) {
      throw new ProviderError('unavailable', NAME, 'Network error', { retryable: true, cause });
    }
    if (res.status === 429) {
      throw new ProviderError('rate_limited', NAME, 'Rate limited', { status: 429, retryable: true });
    }
    if (res.status === 404) {
      throw new ProviderError('not_found', NAME, 'Not found', { status: 404 });
    }
    if (!res.ok) {
      throw new ProviderError('bad_response', NAME, `HTTP ${res.status}`, {
        status: res.status,
        retryable: res.status >= 500,
      });
    }
    return (await res.json()) as T;
  };
}

// ---------- Catalog ----------

export function createTcgdexCatalog(opts: TcgdexAdapterOptions = {}): CardCatalogProvider {
  const request = makeRequest(opts.fetchImpl ?? fetch);
  const defaultLang = opts.language ?? 'en';

  function normalizeSet(s: TcgdexSetFull, language: Language): NormalizedSet {
    return {
      externalId: s.id,
      provider: NAME,
      name: s.name,
      series: s.serie?.name ?? null,
      language,
      printedTotal: s.cardCount?.official ?? null,
      total: s.cardCount?.total ?? null,
      releaseDate: s.releaseDate ? s.releaseDate.replace(/\//g, '-') : null,
      symbolUrl: imageUrl(s.symbol, 'low'),
      logoUrl: s.logo ? `${s.logo}.webp` : null,
      metadata: { source: NAME },
    };
  }

  function normalizeFullCard(c: TcgdexCardFull, language: Language): NormalizedCard {
    const setId = c.set?.id ?? setIdFromCardId(c.id);
    const official = c.set?.cardCount?.official;
    return {
      externalId: c.id,
      provider: NAME,
      setExternalId: setId,
      name: c.name,
      number: c.localId ?? c.id,
      printedNumber: official ? `${c.localId ?? ''}/${official}` : (c.localId ?? null),
      rarity: c.rarity ?? null,
      supertype: c.category ?? null,
      subtypes: [],
      language,
      artist: c.illustrator ?? null,
      regulationMark: c.regulationMark ?? null,
      imageSmallUrl: imageUrl(c.image, 'low'),
      imageLargeUrl: imageUrl(c.image, 'high'),
      metadata: { source: NAME },
    };
  }

  function normalizeBriefCard(c: TcgdexCardBrief, language: Language, setExternalId?: string): NormalizedCard {
    return {
      externalId: c.id,
      provider: NAME,
      setExternalId: setExternalId ?? setIdFromCardId(c.id),
      name: c.name,
      number: c.localId ?? c.id,
      printedNumber: c.localId ?? null,
      rarity: null,
      supertype: null,
      subtypes: [],
      language,
      artist: null,
      regulationMark: null,
      imageSmallUrl: imageUrl(c.image, 'low'),
      imageLargeUrl: imageUrl(c.image, 'high'),
      metadata: { source: NAME, brief: true },
    };
  }

  /** Set endpoint returns every card; cache briefly so infinite-scroll pages don't re-fetch. */
  const setCardsCache = new Map<string, { at: number; cards: NormalizedCard[] }>();
  const SET_CARDS_TTL_MS = 5 * 60_000;

  async function cardsInSet(setExternalId: string, language: Language): Promise<NormalizedCard[]> {
    const key = `${language}:${setExternalId}`;
    const hit = setCardsCache.get(key);
    if (hit && Date.now() - hit.at < SET_CARDS_TTL_MS) return hit.cards;

    const set = await request<TcgdexSetFull>(
      `/${language}/sets/${encodeURIComponent(setExternalId)}`,
    );
    const cards = (set.cards ?? []).map((c) => normalizeBriefCard(c, language, setExternalId));
    setCardsCache.set(key, { at: Date.now(), cards });
    return cards;
  }

  return {
    name: NAME,
    async searchCards(input: CardSearchInput): Promise<CardSearchResult> {
      const language = input.language ?? defaultLang;
      const query = input.query.trim();
      const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);

      // Full set listing: use the set payload (all cards) and page by offset cursor.
      // The /cards search endpoint caps at 100 total results per request and cannot
      // page past that for large sets.
      if (input.setExternalId && !query) {
        const all = await cardsInSet(input.setExternalId, language);
        const offset = input.cursor ? Number(input.cursor) || 0 : 0;
        const cards = all.slice(offset, offset + limit);
        const nextCursor = offset + limit < all.length ? String(offset + limit) : null;
        return { cards, nextCursor };
      }

      // Split a trailing collector number out of the query — plain ("Charizard 4",
      // "199/165") or letter-prefixed ("Meloetta ex RC25", "TG13/TG30"). The \b +
      // 0-4 letter prefix cannot eat a name word ("Meloetta ex" alone stays intact
      // because "ex" has no digits and long words fail the boundary).
      const numberMatch = query.match(/\b([A-Za-z]{0,4}\d{1,4}[a-z]?)(?:\/[A-Za-z]{0,4}\d{1,4})?\s*$/i);
      const number = numberMatch?.[1];
      const nameOnly = number ? query.slice(0, query.length - numberMatch![0].length).trim() : query;

      const params = new URLSearchParams();
      if (nameOnly) params.set('name', nameOnly);
      if (input.setExternalId) params.set('set', input.setExternalId);
      params.set('pagination:itemsPerPage', String(limit));
      params.set('pagination:page', input.cursor ?? '1');

      let cards: TcgdexCardBrief[];
      try {
        cards = await request<TcgdexCardBrief[]>(`/${language}/cards?${params.toString()}`);
      } catch (err) {
        if (err instanceof ProviderError && err.code === 'not_found') {
          return { cards: [], nextCursor: null };
        }
        throw err;
      }

      let normalized = cards.map((c) => normalizeBriefCard(c, language, input.setExternalId));
      // Client-side number filter when the query carried a collector number.
      // Zero-strip the digit part so "RC05"/"RC5" and "058"/"58" compare equal.
      if (number) {
        const canon = (n: string) => n.toLowerCase().replace(/^([a-z]*)0+(?=\d)/, '$1');
        const wanted = canon(number);
        const filtered = normalized.filter((c) => canon(c.number ?? '') === wanted);
        if (filtered.length > 0) normalized = filtered;
      }
      const page = Number(input.cursor ?? '1');
      const nextCursor = normalized.length >= limit ? String(page + 1) : null;
      return { cards: normalized, nextCursor };
    },

    async getCard(externalId: string): Promise<NormalizedCard> {
      const card = await request<TcgdexCardFull>(`/${defaultLang}/cards/${encodeURIComponent(externalId)}`);
      return normalizeFullCard(card, defaultLang);
    },

    async getSet(externalId: string): Promise<NormalizedSet> {
      const set = await request<TcgdexSetFull>(`/${defaultLang}/sets/${encodeURIComponent(externalId)}`);
      return normalizeSet(set, defaultLang);
    },

    async listSets(input: SetSearchInput): Promise<NormalizedSet[]> {
      const language = input.language ?? defaultLang;
      const sets = await request<TcgdexSetBrief[]>(`/${language}/sets`);
      const limited = input.limit ? sets.slice(0, input.limit) : sets;
      return limited.map((s) => normalizeSet(s, language));
    },
  };
}

// ---------- Raw pricing ----------

export function createTcgdexRawPricing(opts: TcgdexAdapterOptions = {}): RawPricingProvider {
  const request = makeRequest(opts.fetchImpl ?? fetch);
  const lang = opts.language ?? 'en';

  function normalize(card: TcgdexCardFull): NormalizedPrice[] {
    const out: NormalizedPrice[] = [];
    const today = new Date().toISOString().slice(0, 10);
    const pricing = card.pricing;

    // TCGplayer (USD), by printing/finish. Effectively Near Mint market prices.
    const tp = pricing?.tcgplayer;
    if (tp) {
      for (const [key, block] of Object.entries(tp)) {
        if (key === 'unit' || key === 'updated' || !block || typeof block === 'string') continue;
        const b = block as TcgdexTcgPlayerBlock;
        const market = b.marketPrice ?? b.midPrice ?? b.lowPrice;
        if (market == null) continue;
        out.push({
          provider: NAME,
          market: 'tcgplayer',
          currency: 'USD',
          condition: 'near_mint',
          finish: mapTcgPlayerFinish(key) as CardFinish,
          valueMinor: toMinor(market),
          lowMinor: b.lowPrice != null ? toMinor(b.lowPrice) : undefined,
          highMinor: b.highPrice != null ? toMinor(b.highPrice) : undefined,
          valuationType: 'market',
          recordedForDate: today,
          providerUpdatedAt: tp.updated as string | undefined,
          freshness: 'live',
        });
      }
    }

    // Cardmarket (EUR).
    const cm = pricing?.cardmarket;
    if (cm) {
      const market = cm.avg ?? cm.trend;
      if (market != null) {
        out.push({
          provider: NAME,
          market: 'cardmarket',
          currency: 'EUR',
          condition: 'near_mint',
          valueMinor: toMinor(market),
          lowMinor: cm.low != null ? toMinor(cm.low) : undefined,
          highMinor: cm.trend != null ? toMinor(cm.trend) : undefined,
          valuationType: 'market',
          recordedForDate: today,
          providerUpdatedAt: cm.updated,
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
      const card = await request<TcgdexCardFull>(
        `/${lang}/cards/${encodeURIComponent(input.cardExternalId)}`,
      );
      const prices = normalize(card);
      return input.finish ? prices.filter((p) => !p.finish || p.finish === input.finish) : prices;
    },

    async getRawPriceHistory(input: PriceHistoryInput): Promise<NormalizedPricePoint[]> {
      // Honest sparse trend from Cardmarket rolling averages (real provider data,
      // not interpolation). Dense daily history accrues via our own snapshots.
      const card = await request<TcgdexCardFull>(
        `/${lang}/cards/${encodeURIComponent(input.cardExternalId)}`,
      );
      const cm = card.pricing?.cardmarket;
      if (!cm) return [];
      const dayMs = 86_400_000;
      const now = Date.now();
      const series: Array<{ offsetDays: number; value: number | null | undefined }> = [
        { offsetDays: 30, value: cm.avg30 },
        { offsetDays: 7, value: cm.avg7 },
        { offsetDays: 1, value: cm.avg1 },
        { offsetDays: 0, value: cm.avg ?? cm.trend },
      ];
      const fromMs = input.from ? new Date(input.from).getTime() : 0;
      const seen = new Set<string>();
      const points: NormalizedPricePoint[] = [];
      for (const { offsetDays, value } of series) {
        if (value == null) continue;
        const ts = now - offsetDays * dayMs;
        if (ts < fromMs) continue;
        const date = new Date(ts).toISOString().slice(0, 10);
        if (seen.has(date)) continue;
        seen.add(date);
        points.push({ date, valueMinor: toMinor(value), currency: 'EUR', freshness: 'live' });
      }
      return points;
    },
  };
}
