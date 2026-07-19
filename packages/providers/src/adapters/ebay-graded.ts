/**
 * eBay graded-pricing adapter (free, official API).
 *
 * Free sources for real graded SOLD prices don't exist — sold data is a
 * restricted eBay API and licensed guides (PriceCharting) are paid. What IS
 * free, official, and durable is eBay's Browse API: live fixed-price listings
 * whose titles carry the grading company + grade ("PSA 10", "BGS 9.5", ...).
 *
 * This adapter searches one query per grading company per card, parses grades
 * out of listing titles, and derives an honest value from the ASK distribution:
 * the lower quartile of cleaned asks (listings priced to sell), with min/median
 * as the range. Values are labeled `market: 'ebay-asks'` and valuationType
 * 'estimate' so the UI can say exactly what they are — asking prices, not
 * completed sales.
 *
 * Requires a free eBay developer keyset (developer.ebay.com): client id +
 * secret, exchanged via the client-credentials OAuth flow.
 */

import type {
  GradedPricingProvider,
  CardCatalogProvider,
  GradedPricingInput,
  GradedHistoryInput,
  NormalizedGradedPrice,
  NormalizedPricePoint,
} from '../interfaces';
import { ProviderError } from '../errors';
import type { GradingCompany } from '@psr/types';

const NAME = 'ebay';
const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
/** eBay category: CCG Individual Cards. */
const CCG_CATEGORY = '183454';

const COMPANIES: GradingCompany[] = ['psa', 'bgs', 'cgc', 'sgc'];

/** Listings that are not the actual single graded card. */
const EXCLUDE_RE =
  /proxy|custom|replica|reprint|digital|jumbo|oversized|\blot\b|bundle|\bbreak\b|sticker|coin|\bpin\b|playmat|sleeve|binder|box\b|pack\b|mystery/i;

/** company token then a grade within a few characters ("PSA 10", "CGC Pristine 10", "BGS-9.5"). */
const GRADE_RE = /\b(PSA|BGS|BECKETT|CGC|SGC)\b[^0-9]{0,18}\b(10|[1-9](?:\.5)?)\b/i;

const COMPANY_ALIAS: Record<string, GradingCompany> = {
  psa: 'psa',
  bgs: 'bgs',
  beckett: 'bgs',
  cgc: 'cgc',
  sgc: 'sgc',
};

interface EbayItemSummary {
  title?: string;
  price?: { value?: string; currency?: string };
}

export interface EbayGradedOptions {
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  /** Cache TTL for per-card/company searches (default 6h). */
  cacheTtlMs?: number;
}

/** Percentile over a sorted ascending array (nearest-rank). */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

/** Drop junk asks: scam-cheap (<30% of median) and delusional (>3× median). */
export function cleanAsks(asksMinor: number[]): number[] {
  if (asksMinor.length === 0) return [];
  const sorted = [...asksMinor].sort((a, b) => a - b);
  const median = percentile(sorted, 50);
  return sorted.filter((v) => v >= median * 0.3 && v <= median * 3);
}

/** Parse a listing title into { company, grade } when it names one cleanly. */
export function parseGradeFromTitle(
  title: string,
): { company: GradingCompany; grade: string } | null {
  const m = title.match(GRADE_RE);
  if (!m) return null;
  const company = COMPANY_ALIAS[m[1]!.toLowerCase()];
  if (!company) return null;
  return { company, grade: m[2]! };
}

export function createEbayGradedPricing(
  catalog: CardCatalogProvider,
  options: EbayGradedOptions,
): GradedPricingProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const cacheTtl = options.cacheTtlMs ?? 6 * 60 * 60 * 1000;

  let token: { value: string; expiresAt: number } | null = null;
  const searchCache = new Map<string, { at: number; prices: NormalizedGradedPrice[] }>();

  async function getToken(): Promise<string> {
    if (token && Date.now() < token.expiresAt) return token.value;
    const basic =
      typeof Buffer !== 'undefined'
        ? Buffer.from(`${options.clientId}:${options.clientSecret}`).toString('base64')
        : btoa(`${options.clientId}:${options.clientSecret}`);
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
    });
    if (!res.ok) {
      throw new ProviderError('bad_response', NAME, `eBay OAuth failed (${res.status}).`);
    }
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) {
      throw new ProviderError('bad_response', NAME, 'eBay OAuth returned no token.');
    }
    // Refresh 5 minutes early.
    token = {
      value: body.access_token,
      expiresAt: Date.now() + ((body.expires_in ?? 7200) - 300) * 1000,
    };
    return token.value;
  }

  async function searchCompany(
    cardName: string,
    setName: string | null,
    number: string | null,
    company: GradingCompany,
  ): Promise<Map<string, number[]>> {
    const q = [cardName, setName ?? '', number ?? '', company.toUpperCase()]
      .filter(Boolean)
      .join(' ');
    const params = new URLSearchParams({
      q,
      limit: '100',
      category_ids: CCG_CATEGORY,
      filter: 'buyingOptions:{FIXED_PRICE},priceCurrency:USD',
      sort: 'price',
    });
    const res = await fetchImpl(`${SEARCH_URL}?${params}`, {
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    });
    if (!res.ok) {
      throw new ProviderError('bad_response', NAME, `eBay search failed (${res.status}).`);
    }
    const body = (await res.json()) as { itemSummaries?: EbayItemSummary[] };
    const items = body.itemSummaries ?? [];

    // The card's first name word must appear in the title — cheap guard
    // against unrelated listings that matched on set keywords alone.
    const nameToken = cardName.split(/[\s\-–—]+/)[0]?.toLowerCase() ?? '';

    const buckets = new Map<string, number[]>();
    for (const item of items) {
      const title = item.title ?? '';
      if (!title || EXCLUDE_RE.test(title)) continue;
      if (nameToken && !title.toLowerCase().includes(nameToken)) continue;
      const parsed = parseGradeFromTitle(title);
      if (!parsed || parsed.company !== company) continue;
      const value = Number(item.price?.value);
      if (!Number.isFinite(value) || value <= 0) continue;
      if ((item.price?.currency ?? 'USD') !== 'USD') continue;
      const minor = Math.round(value * 100);
      const list = buckets.get(parsed.grade) ?? [];
      list.push(minor);
      buckets.set(parsed.grade, list);
    }
    return buckets;
  }

  return {
    name: NAME,

    async getCurrentGradedPrices(input: GradedPricingInput): Promise<NormalizedGradedPrice[]> {
      const cacheKey = `${input.cardExternalId}:${input.gradingCompany ?? 'all'}`;
      const hit = searchCache.get(cacheKey);
      if (hit && Date.now() - hit.at < cacheTtl) return hit.prices;

      const card = await catalog.getCard(input.cardExternalId);
      const setName = await catalog
        .getSet(card.setExternalId)
        .then((s) => s.name)
        .catch(() => null);

      const companies = input.gradingCompany ? [input.gradingCompany] : COMPANIES;
      const today = new Date().toISOString().slice(0, 10);
      const prices: NormalizedGradedPrice[] = [];

      for (const company of companies) {
        let buckets: Map<string, number[]>;
        try {
          buckets = await searchCompany(card.name, setName, card.number, company);
        } catch (err) {
          // One company failing must not empty the whole table.
          // eslint-disable-next-line no-console
          console.error(`[ebay-graded] ${company} search failed:`, err);
          continue;
        }
        for (const [grade, asks] of buckets) {
          const cleaned = cleanAsks(asks);
          if (cleaned.length === 0) continue;
          prices.push({
            provider: NAME,
            market: 'ebay-asks',
            currency: 'USD',
            gradingCompany: company,
            grade,
            // Lower quartile of live asks ≈ "priced to sell now" — an honest
            // proxy given sold data isn't freely available.
            valueMinor: percentile(cleaned, 25),
            lowMinor: cleaned[0]!,
            highMinor: percentile(cleaned, 50),
            sampleSize: cleaned.length,
            valuationType: 'estimate',
            recordedForDate: today,
            freshness: 'live',
          });
        }
      }

      // Highest grades first within each company, companies in fixed order.
      prices.sort((a, b) => {
        const co = COMPANIES.indexOf(a.gradingCompany) - COMPANIES.indexOf(b.gradingCompany);
        if (co !== 0) return co;
        return Number(b.grade) - Number(a.grade);
      });

      searchCache.set(cacheKey, { at: Date.now(), prices });
      return prices;
    },

    async getGradedPriceHistory(_input: GradedHistoryInput): Promise<NormalizedPricePoint[]> {
      // Browse only exposes current listings — no free history series exists.
      return [];
    },
  };
}
