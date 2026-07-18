/**
 * PriceCharting adapter — LIVE graded card prices.
 *
 * PriceCharting (https://www.pricecharting.com) publishes market values for
 * graded trading cards derived from real sold listings. API access requires
 * a paid PriceCharting subscription; the 40-char token is passed as `t`.
 *
 * Card-grade field mapping (per their API docs):
 *   loose-price          → ungraded (not emitted here)
 *   cib-price            → Grade 7  (any grading company)
 *   new-price            → Grade 8  (any grading company)
 *   graded-price         → Grade 9  (any grading company)
 *   box-only-price       → Grade 9.5 (any grading company)
 *   manual-only-price    → PSA 10
 *   bgs-10-price         → BGS 10
 *   condition-17-price   → CGC 10
 *   condition-18-price   → SGC 10
 *
 * Prices are integer pennies (== our USD minor units, no conversion needed).
 * The API allows 1 request/second, so lookups are throttled and results are
 * cached in-memory. The standard API exposes current values only — no
 * history — so getGradedPriceHistory returns [].
 *
 * Not affiliated with or endorsed by PriceCharting or any grading company.
 */

import type {
  GradedPricingProvider,
  CardCatalogProvider,
  GradedPricingInput,
  GradedHistoryInput,
  NormalizedGradedPrice,
  NormalizedPricePoint,
} from '../interfaces';
import type { GradingCompany } from '@psr/types';
import { ProviderError } from '../errors';
import { stringSimilarity } from './catalog-ocr-recognition';

const NAME = 'pricecharting';
const BASE = 'https://www.pricecharting.com';

interface PcProduct {
  status: string;
  id?: string;
  'product-name'?: string;
  'console-name'?: string;
  'loose-price'?: number;
  'cib-price'?: number;
  'new-price'?: number;
  'graded-price'?: number;
  'box-only-price'?: number;
  'manual-only-price'?: number;
  'bgs-10-price'?: number;
  'condition-17-price'?: number;
  'condition-18-price'?: number;
  'sales-volume'?: number;
  'error-message'?: string;
}

interface GradeField {
  key: keyof PcProduct;
  gradingCompany: GradingCompany;
  grade: string;
  label?: string;
}

/** Order matters only for display; each entry is emitted when priced. */
const GRADE_FIELDS: GradeField[] = [
  { key: 'manual-only-price', gradingCompany: 'psa', grade: '10' },
  { key: 'bgs-10-price', gradingCompany: 'bgs', grade: '10' },
  { key: 'condition-17-price', gradingCompany: 'cgc', grade: '10' },
  { key: 'condition-18-price', gradingCompany: 'sgc', grade: '10' },
  { key: 'box-only-price', gradingCompany: 'psa', grade: '9.5', label: 'Grade 9.5 · any grading co.' },
  { key: 'graded-price', gradingCompany: 'psa', grade: '9', label: 'Grade 9 · any grading co.' },
  { key: 'new-price', gradingCompany: 'psa', grade: '8', label: 'Grade 8 · any grading co.' },
  { key: 'cib-price', gradingCompany: 'psa', grade: '7', label: 'Grade 7 · any grading co.' },
];

export interface PriceChartingOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  /** Cache TTL for per-card lookups (default 6h). */
  cacheTtlMs?: number;
  /** Minimum spacing between API calls (default 1100ms per their 1rps limit). */
  throttleMs?: number;
  /** Minimum name similarity for a match to be trusted (default 0.5). */
  minNameSimilarity?: number;
}

export function createPriceChartingGradedPricing(
  catalog: CardCatalogProvider,
  options: PriceChartingOptions,
): GradedPricingProvider {
  const doFetch = options.fetchImpl ?? fetch;
  const cacheTtl = options.cacheTtlMs ?? 6 * 60 * 60 * 1000;
  const throttleMs = options.throttleMs ?? 1100;
  const minSimilarity = options.minNameSimilarity ?? 0.5;

  const cache = new Map<string, { at: number; prices: NormalizedGradedPrice[] }>();
  let lastCallAt = 0;
  let chain: Promise<unknown> = Promise.resolve();

  /** Serialize + space API calls to respect the 1 request/second limit. */
  function throttled<T>(fn: () => Promise<T>): Promise<T> {
    const next = chain.then(async () => {
      const wait = lastCallAt + throttleMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastCallAt = Date.now();
      return fn();
    });
    chain = next.catch(() => {});
    return next;
  }

  async function request(path: string): Promise<PcProduct> {
    let res: Response;
    try {
      res = await doFetch(`${BASE}${path}&t=${encodeURIComponent(options.apiKey)}`, {
        headers: { Accept: 'application/json' },
      });
    } catch (cause) {
      throw new ProviderError('unavailable', NAME, 'Network error', { retryable: true, cause });
    }
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError('unauthorized', NAME, 'PriceCharting rejected the API token', {
        status: res.status,
      });
    }
    if (!res.ok) {
      throw new ProviderError('bad_response', NAME, `HTTP ${res.status}`, {
        status: res.status,
        retryable: res.status >= 500,
      });
    }
    const body = (await res.json()) as PcProduct;
    if (body.status !== 'success') {
      throw new ProviderError('bad_response', NAME, body['error-message'] ?? 'API error');
    }
    return body;
  }

  /** Does this product plausibly match the requested card? */
  function matches(product: PcProduct, cardName: string, cardNumber: string): boolean {
    const productName = product['product-name'] ?? '';
    const console = product['console-name'] ?? '';
    if (!/pokemon/i.test(console) && !/pokemon/i.test(productName)) return false;
    // Collector number: PC titles carry "#4"-style suffixes.
    const numberOk =
      !cardNumber ||
      new RegExp(`#${cardNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\D|$)`, 'i').test(
        productName,
      );
    const nameOnly = productName.replace(/#\S+/g, '').trim();
    return numberOk && stringSimilarity(nameOnly, cardName) >= minSimilarity;
  }

  function toPrices(product: PcProduct): NormalizedGradedPrice[] {
    const today = new Date().toISOString().slice(0, 10);
    const out: NormalizedGradedPrice[] = [];
    for (const field of GRADE_FIELDS) {
      const minor = product[field.key];
      if (typeof minor !== 'number' || minor <= 0) continue;
      out.push({
        provider: NAME,
        market: 'pricecharting',
        currency: 'USD',
        gradingCompany: field.gradingCompany,
        grade: field.grade,
        label: field.label,
        valueMinor: minor,
        sampleSize: product['sales-volume'],
        valuationType: 'market',
        recordedForDate: today,
        freshness: 'live',
      });
    }
    if (out.length === 0) {
      throw new ProviderError('not_found', NAME, 'No graded prices for this card');
    }
    return out;
  }

  async function lookup(cardExternalId: string): Promise<NormalizedGradedPrice[]> {
    const hit = cache.get(cardExternalId);
    if (hit && Date.now() - hit.at < cacheTtl) return hit.prices;

    const card = await catalog.getCard(cardExternalId);
    const set = await catalog.getSet(card.setExternalId).catch(() => null);
    const number = (card.number ?? '').split('/')[0] ?? '';
    const query = ['pokemon', set?.name ?? '', card.name, number ? `#${number}` : '']
      .filter(Boolean)
      .join(' ');

    // Best-match lookup returns prices in a single call; trust it only when
    // the product plausibly matches the card we asked about.
    const product = await throttled(() =>
      request(`/api/product?q=${encodeURIComponent(query)}`),
    );
    if (!matches(product, card.name, number)) {
      throw new ProviderError(
        'not_found',
        NAME,
        `No confident PriceCharting match for ${card.name} #${number}`,
      );
    }

    const prices = toPrices(product);
    cache.set(cardExternalId, { at: Date.now(), prices });
    return prices;
  }

  return {
    name: NAME,
    async getCurrentGradedPrices(input: GradedPricingInput): Promise<NormalizedGradedPrice[]> {
      const prices = await lookup(input.cardExternalId);
      return input.gradingCompany
        ? prices.filter((p) => p.gradingCompany === input.gradingCompany)
        : prices;
    },
    async getGradedPriceHistory(_input: GradedHistoryInput): Promise<NormalizedPricePoint[]> {
      // The standard PriceCharting API exposes current values only.
      return [];
    },
  };
}
