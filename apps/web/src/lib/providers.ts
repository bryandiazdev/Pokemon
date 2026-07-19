import 'server-only';
import { buildRegistry, type ProviderRegistry, type ProviderConfig } from '@psr/providers';
import { env } from './env';

/**
 * Provider wiring with ZERO-CONFIG live upgrade: if a Pokémon TCG API key is
 * present, catalog + raw pricing automatically go live (unless an env selector
 * was set to something else on purpose). So "just add the key" is all it takes.
 */
export interface ProviderStatus {
  catalogLive: boolean;
  rawPricingLive: boolean;
  gradedPricingLive: boolean;
  recognitionLive: boolean;
  /** True when any real data source is active. */
  anyLive: boolean;
  /** Human name of the active catalog source, e.g. "TCGdex". */
  sourceName: string;
}

const unset = (v: string | undefined): boolean => v === undefined || v === '';

const SOURCE_NAMES: Record<string, string> = {
  demo: 'demo data',
  tcgdex: 'TCGdex',
  pokemontcg: 'the Pokémon TCG API',
};

/**
 * Resolve the effective catalog/pricing provider from (in priority order):
 *  1. an explicit per-capability selector (CATALOG_PROVIDER / RAW_PRICING_PROVIDER),
 *  2. PROVIDER_PRESET (demo | tcgdex | pokemontcg),
 *  3. presence of a Pokémon TCG API key → pokemontcg,
 *  4. demo.
 * TCGdex needs no key, so `PROVIDER_PRESET=tcgdex` is free live data with zero secrets.
 */
function resolveSelectors(): ProviderConfig {
  const hasPtcgKey = Boolean(env.POKEMON_TCG_API_KEY);
  const preset = env.PROVIDER_PRESET;

  const presetChoice = (): string => {
    if (preset === 'tcgdex') return 'tcgdex';
    if (preset === 'pokemontcg' || hasPtcgKey) return 'pokemontcg';
    return 'demo';
  };

  const catalog = unset(process.env.CATALOG_PROVIDER) ? presetChoice() : env.CATALOG_PROVIDER;
  const rawPricing = unset(process.env.RAW_PRICING_PROVIDER) ? presetChoice() : env.RAW_PRICING_PROVIDER;
  // Recognition rides the catalog: a live catalog implies the catalog-OCR
  // scanner unless the selector was set explicitly.
  const recognition = unset(process.env.RECOGNITION_PROVIDER)
    ? catalog === 'demo'
      ? 'demo'
      : 'catalog-ocr'
    : env.RECOGNITION_PROVIDER;
  // Graded pricing goes live automatically (needs a live catalog to resolve
  // card names for the lookup). Preference order:
  //   PriceCharting (paid key — real sold prices)
  //   > eBay Browse (free developer keyset — live ask-based estimates)
  //   > demo.
  const hasEbay = Boolean(env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET);
  const gradedPricing = unset(process.env.GRADED_PRICING_PROVIDER)
    ? catalog === 'demo'
      ? 'demo'
      : env.PRICECHARTING_API_KEY
        ? 'pricecharting'
        : hasEbay
          ? 'ebay'
          : 'demo'
    : env.GRADED_PRICING_PROVIDER;

  return {
    catalog,
    recognition,
    rawPricing,
    gradedPricing,
    population: env.POPULATION_PROVIDER,
    certification: env.CERTIFICATION_PROVIDER,
    activeListings: env.ACTIVE_LISTINGS_PROVIDER,
    pokemonTcgApiKey: env.POKEMON_TCG_API_KEY,
    priceChartingApiKey: env.PRICECHARTING_API_KEY,
    ebayClientId: env.EBAY_CLIENT_ID,
    ebayClientSecret: env.EBAY_CLIENT_SECRET,
  };
}

let registrySingleton: ProviderRegistry | null = null;

export function getRegistry(): ProviderRegistry {
  if (registrySingleton) return registrySingleton;
  registrySingleton = buildRegistry(resolveSelectors(), {
    timeoutMs: 8000,
    retries: 2,
    usageSink: {
      record(log) {
        if (env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.debug('[provider]', log.provider, log.operation, log.status, `${log.durationMs}ms`);
        }
      },
    },
  });
  return registrySingleton;
}

/** Which capabilities are backed by a live data source (for honest UI badges). */
export function getProviderStatus(): ProviderStatus {
  const s = resolveSelectors();
  const catalogLive = s.catalog !== 'demo';
  const rawPricingLive = s.rawPricing !== 'demo';
  const gradedPricingLive = s.gradedPricing !== 'demo';
  const recognitionLive = s.recognition !== 'demo';
  return {
    catalogLive,
    rawPricingLive,
    gradedPricingLive,
    recognitionLive,
    anyLive: catalogLive || rawPricingLive || gradedPricingLive || recognitionLive,
    sourceName: SOURCE_NAMES[rawPricingLive ? s.rawPricing : s.catalog] ?? s.catalog,
  };
}
