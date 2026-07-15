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
}

const unset = (v: string | undefined): boolean => v === undefined || v === '';

function resolveSelectors(): ProviderConfig {
  const hasPtcgKey = Boolean(env.POKEMON_TCG_API_KEY);

  // Auto-upgrade to the live adapter ONLY when the selector is genuinely unset
  // (an explicit `=demo` is respected). This is the "just add the key" magic.
  const catalog = unset(process.env.CATALOG_PROVIDER)
    ? hasPtcgKey
      ? 'pokemontcg'
      : 'demo'
    : env.CATALOG_PROVIDER;
  const rawPricing = unset(process.env.RAW_PRICING_PROVIDER)
    ? hasPtcgKey
      ? 'pokemontcg'
      : 'demo'
    : env.RAW_PRICING_PROVIDER;

  return {
    catalog,
    recognition: env.RECOGNITION_PROVIDER,
    rawPricing,
    gradedPricing: env.GRADED_PRICING_PROVIDER,
    population: env.POPULATION_PROVIDER,
    certification: env.CERTIFICATION_PROVIDER,
    activeListings: env.ACTIVE_LISTINGS_PROVIDER,
    pokemonTcgApiKey: env.POKEMON_TCG_API_KEY,
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
  };
}
