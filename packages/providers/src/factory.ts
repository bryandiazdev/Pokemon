/**
 * Builds a ProviderRegistry from configuration. Selecting a live provider is a
 * config change, not a rewrite. Unknown/unimplemented selectors fall back to the
 * demo adapter with a console warning so the app stays navigable.
 */

import { ProviderRegistry, type RegistryOptions } from './registry';
import type { Capability, ProviderCapabilities } from './interfaces';
import { demoProviderCapabilities } from './adapters/demo';
import { createPokemonTcgCatalog } from './adapters/pokemontcg';
import { createPokemonTcgRawPricing } from './adapters/pokemontcg-pricing';
import { createTcgdexCatalog, createTcgdexRawPricing } from './adapters/tcgdex';
import { createCatalogOcrRecognition } from './adapters/catalog-ocr-recognition';
import { createPriceChartingGradedPricing } from './adapters/pricecharting';

export interface ProviderConfig {
  catalog: string;
  recognition: string;
  rawPricing: string;
  gradedPricing: string;
  population: string;
  certification: string;
  activeListings: string;
  pokemonTcgApiKey?: string;
  priceChartingApiKey?: string;
}

export function buildRegistry(
  config: ProviderConfig,
  registryOptions: RegistryOptions = {},
): ProviderRegistry {
  const registry = new ProviderRegistry(registryOptions);
  const demo = demoProviderCapabilities();
  const primary: ProviderCapabilities = {};

  const warn = (cap: Capability, sel: string) =>
    // eslint-disable-next-line no-console
    console.warn(
      `[providers] ${cap} provider "${sel}" is not implemented as a live adapter; using demo fixtures. See docs/DATA_PROVIDERS.md.`,
    );

  // Catalog — TCGdex (free, keyless) and Pokémon TCG API are both live options.
  if (config.catalog === 'tcgdex') {
    primary.catalog = createTcgdexCatalog();
  } else if (config.catalog === 'pokemontcg') {
    primary.catalog = createPokemonTcgCatalog({ apiKey: config.pokemonTcgApiKey });
  } else {
    if (config.catalog !== 'demo') warn('catalog', config.catalog);
    primary.catalog = demo.catalog;
  }

  // Recognition: live "catalog-ocr" adapter, else demo.
  if (config.recognition === 'catalog-ocr') {
    primary.recognition = createCatalogOcrRecognition(primary.catalog!);
  } else {
    if (config.recognition !== 'demo') warn('recognition', config.recognition);
    primary.recognition = demo.recognition;
  }

  // Raw pricing: TCGdex (free, keyless) or Pokémon TCG adapter, else demo.
  if (config.rawPricing === 'tcgdex') {
    primary.rawPricing = createTcgdexRawPricing();
  } else if (config.rawPricing === 'pokemontcg') {
    primary.rawPricing = createPokemonTcgRawPricing({ apiKey: config.pokemonTcgApiKey });
  } else {
    if (config.rawPricing !== 'demo') warn('rawPricing', config.rawPricing);
    primary.rawPricing = demo.rawPricing;
  }

  // Graded pricing: PriceCharting (paid key) is the live option, else demo.
  if (config.gradedPricing === 'pricecharting' && config.priceChartingApiKey) {
    primary.gradedPricing = createPriceChartingGradedPricing(primary.catalog!, {
      apiKey: config.priceChartingApiKey,
    });
  } else {
    if (config.gradedPricing !== 'demo') warn('gradedPricing', config.gradedPricing);
    primary.gradedPricing = demo.gradedPricing;
  }

  // Remaining capabilities: only demo adapters are implemented in this build.
  const remaining: [Capability, keyof ProviderConfig][] = [
    ['population', 'population'],
    ['certification', 'certification'],
    ['activeListings', 'activeListings'],
  ];
  for (const [cap, key] of remaining) {
    const sel = String(config[key]);
    if (sel !== 'demo') warn(cap, sel);
    // @ts-expect-error indexed capability assignment is safe here
    primary[cap] = demo[cap];
  }

  registry.setPrimary(primary);
  // Demo fixtures are always available as a last-resort fallback in non-prod.
  registry.addFallback(demo);
  return registry;
}
