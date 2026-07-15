import 'server-only';
import { buildRegistry, type ProviderRegistry } from '@psr/providers';
import { env } from './env';

let registrySingleton: ProviderRegistry | null = null;

/** Process-wide provider registry, configured from env selectors. */
export function getRegistry(): ProviderRegistry {
  if (registrySingleton) return registrySingleton;
  registrySingleton = buildRegistry(
    {
      catalog: env.CATALOG_PROVIDER,
      recognition: env.RECOGNITION_PROVIDER,
      rawPricing: env.RAW_PRICING_PROVIDER,
      gradedPricing: env.GRADED_PRICING_PROVIDER,
      population: env.POPULATION_PROVIDER,
      certification: env.CERTIFICATION_PROVIDER,
      activeListings: env.ACTIVE_LISTINGS_PROVIDER,
      pokemonTcgApiKey: env.POKEMON_TCG_API_KEY,
    },
    {
      timeoutMs: 8000,
      retries: 2,
      // Usage sink would persist to provider_request_logs in live mode.
      usageSink: {
        record(log) {
          if (env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-console
            console.debug('[provider]', log.provider, log.operation, log.status, `${log.durationMs}ms`);
          }
        },
      },
    },
  );
  return registrySingleton;
}
