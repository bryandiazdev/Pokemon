import { z } from 'zod';

/**
 * Environment validation. Fails fast with a readable error at boot.
 *
 * In `DATA_MODE=demo` (the default) every paid/provider credential is OPTIONAL,
 * so the whole app runs locally with zero secrets. In `DATA_MODE=live`, the
 * relevant provider keys become required for the selected providers.
 */

const providerSelector = z
  .enum([
    'demo',
    'pokemontcg',
    'catalog-ocr',
    'tcgdex',
    'scrydex',
    'justtcg',
    'pricecharting',
    'psa',
    'ebay',
    'cardmarket',
  ])
  .default('demo');

const optionalUrl = z.string().url().optional().or(z.literal('').transform(() => undefined));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** Master switch for fixtures vs. live data. */
  DATA_MODE: z.enum(['demo', 'live']).default('demo'),

  /**
   * One-knob provider preset for catalog + raw pricing:
   *  - demo       → fixtures (offline, deterministic; default)
   *  - tcgdex     → FREE live data, no API key required (recommended)
   *  - pokemontcg → Pokémon TCG API (optional key)
   * Individual CATALOG_PROVIDER / RAW_PRICING_PROVIDER still override this.
   */
  PROVIDER_PRESET: z.enum(['demo', 'tcgdex', 'pokemontcg']).default('demo'),

  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Supabase — optional in demo (app can run fully offline with fixtures).
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),

  // Stripe — optional in demo (mock billing mode).
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_COLLECTOR_PRO_MONTHLY_PRICE_ID: z.string().optional(),
  STRIPE_COLLECTOR_PRO_ANNUAL_PRICE_ID: z.string().optional(),

  // Infra — optional; each integration no-ops with a warning when absent.
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  TRIGGER_SECRET_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: optionalUrl,

  // Vision service.
  VISION_SERVICE_URL: optionalUrl,
  VISION_SERVICE_API_KEY: z.string().optional(),

  // Provider selectors.
  CATALOG_PROVIDER: providerSelector,
  RECOGNITION_PROVIDER: providerSelector,
  RAW_PRICING_PROVIDER: providerSelector,
  GRADED_PRICING_PROVIDER: providerSelector,
  POPULATION_PROVIDER: providerSelector,
  CERTIFICATION_PROVIDER: providerSelector,
  ACTIVE_LISTINGS_PROVIDER: providerSelector,

  // Provider credentials — only required when the matching provider is selected in live mode.
  SCRYDEX_API_KEY: z.string().optional(),
  JUSTTCG_API_KEY: z.string().optional(),
  POKEMON_TCG_API_KEY: z.string().optional(),
  PRICECHARTING_API_KEY: z.string().optional(),
  PSA_API_KEY: z.string().optional(),
  EBAY_CLIENT_ID: z.string().optional(),
  EBAY_CLIENT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Reconcile cross-field constraints WITHOUT ever throwing.
 *
 * A misconfigured env must never brick the app at runtime (Next.js loads this
 * lazily per dynamic route, so a throw here 500s pages one-by-one). Instead we
 * gracefully downgrade to demo mode and warn. Genuinely malformed values (wrong
 * types) are still rejected by the Zod parse below — that is a real boot error.
 */
function reconcile(env: Env): Env {
  if (
    env.DATA_MODE === 'live' &&
    (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      '[config] DATA_MODE=live but NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'are not set — falling back to demo mode. Configure Supabase to enable live accounts.',
    );
    return { ...env, DATA_MODE: 'demo' };
  }
  return env;
}

let cached: Env | null = null;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const lines = Object.entries(flat)
      .map(([k, v]) => `  - ${k}: ${(v ?? []).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${lines}`);
  }
  cached = reconcile(parsed.data);
  return cached;
}

/** Test-only: reset the memoized env. */
export function __resetEnvCache(): void {
  cached = null;
}

export const isDemoMode = (env: Env): boolean => env.DATA_MODE === 'demo';
