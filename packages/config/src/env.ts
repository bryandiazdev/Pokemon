import { z } from 'zod';

/**
 * Environment validation — SELF-HEALING, never throws at runtime.
 *
 * `src/lib/env.ts` evaluates this at module import, which happens on the first
 * request to any dynamic route. A throw here therefore 500s the entire site
 * while static pages keep working — the worst possible failure mode, and easy
 * to trigger with a pasted trailing space, surrounding quotes, a URL missing
 * https://, or a wrong-case enum in a dashboard env editor.
 *
 * Strategy: sanitize raw values (trim, strip quotes, add https:// to bare
 * hosts, case-fold enums), then parse; any field that STILL fails validation is
 * dropped to its default with a recorded diagnostic instead of throwing. The
 * `/api/health/env` endpoint exposes those diagnostics (never secret values) so
 * a misconfigured deploy is observable instead of a mystery 500.
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

const optionalUrl = z
  .string()
  .url()
  .optional()
  .or(z.literal('').transform(() => undefined));

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
  RESEND_FROM_EMAIL: z
    .string()
    .email()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: optionalUrl,

  // Vision service (optional local OpenCV microservice).
  VISION_SERVICE_URL: optionalUrl,
  VISION_SERVICE_API_KEY: z.string().optional(),

  /**
   * OpenAI — optional. When set, Grade Potential sends uploaded card photos to
   * a vision-capable chat model for condition analysis (alongside or instead of
   * the local vision service). Get a key at https://platform.openai.com/api-keys
   */
  OPENAI_API_KEY: z.string().min(1).optional(),
  /** Defaults to gpt-4o (vision). Override e.g. gpt-4o-mini for cost. */
  OPENAI_GRADE_MODEL: z.string().default('gpt-4o'),
  /**
   * Model for quick-scan card identification (reads name + collector number
   * off the photo). gpt-4o reads tiny collector numbers and stylized names
   * far more reliably than mini; override to gpt-4o-mini to save cost.
   */
  OPENAI_SCAN_MODEL: z.string().default('gpt-4o'),

  /**
   * Anthropic — optional. When set, Claude is the PREFERRED vision provider
   * for quick-scan identification and Grade Potential (OpenAI becomes the
   * fallback). Get a key at https://platform.claude.com
   */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_SCAN_MODEL: z.string().default('claude-opus-4-8'),
  ANTHROPIC_GRADE_MODEL: z.string().default('claude-opus-4-8'),

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

/** Diagnostics from the last loadEnv() — safe to expose (names only, no values). */
export interface EnvDiagnostics {
  /** Fields whose values failed validation and were dropped to defaults. */
  droppedKeys: string[];
  /** Human-readable notes (sanitizations applied, downgrades, drops). */
  warnings: string[];
  /** True when DATA_MODE=live was downgraded to demo (Supabase missing/invalid). */
  liveDowngraded: boolean;
  /**
   * True when NEXT_PUBLIC_SUPABASE_URL pointed at localhost/loopback on a
   * hosted deploy (Vercel). That config can never work from the cloud and
   * previously hung auth calls until the serverless function timed out.
   */
  supabaseLoopbackRejected: boolean;
}

const diagnostics: EnvDiagnostics = {
  droppedKeys: [],
  warnings: [],
  liveDowngraded: false,
  supabaseLoopbackRejected: false,
};

/** Fields that must be URLs — bare hosts get https:// prepended. */
const URL_FIELDS = new Set([
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'UPSTASH_REDIS_REST_URL',
  'NEXT_PUBLIC_POSTHOG_HOST',
  'VISION_SERVICE_URL',
]);

/** Fields whose values are case-insensitive enums — fold to lowercase. */
const ENUM_FIELDS = new Set([
  'NODE_ENV',
  'DATA_MODE',
  'PROVIDER_PRESET',
  'CATALOG_PROVIDER',
  'RECOGNITION_PROVIDER',
  'RAW_PRICING_PROVIDER',
  'GRADED_PRICING_PROVIDER',
  'POPULATION_PROVIDER',
  'CERTIFICATION_PROVIDER',
  'ACTIVE_LISTINGS_PROVIDER',
]);

/** True for hosts that are unreachable from a hosted serverless runtime. */
export function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h === '[::1]' ||
    h.endsWith('.local')
  );
}

/** Detect whether we're running on a hosted platform (not a laptop). */
function isHostedRuntime(source: Record<string, string | undefined>): boolean {
  return (
    source.VERCEL === '1' ||
    source.VERCEL === 'true' ||
    Boolean(source.VERCEL_ENV) ||
    source.AWS_LAMBDA_FUNCTION_NAME !== undefined ||
    source.CF_PAGES === '1'
  );
}
/**
 * Clean a single raw env value the way dashboards commonly mangle them:
 * surrounding whitespace, pasted quotes, missing URL protocol, cased enums.
 */
function sanitizeValue(key: string, raw: string): string {
  let v = raw.trim();
  // Strip one layer of matching surrounding quotes ("..." or '...').
  if (
    v.length >= 2 &&
    ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
  ) {
    v = v.slice(1, -1).trim();
  }
  if (ENUM_FIELDS.has(key)) v = v.toLowerCase();
  if (URL_FIELDS.has(key) && v && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) {
    v = `https://${v}`;
  }
  return v;
}

function sanitizeSource(
  source: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const keys = Object.keys(envSchema.shape) as Array<keyof typeof envSchema.shape>;
  const out: Record<string, string | undefined> = {};
  for (const key of keys) {
    const raw = source[key as string];
    if (raw === undefined) continue;
    const cleaned = sanitizeValue(key as string, raw);
    if (cleaned !== raw) {
      diagnostics.warnings.push(
        `${String(key)}: value sanitized (whitespace/quotes/protocol/case)`,
      );
    }
    // Empty string means "unset" — dashboards often save empties.
    out[key as string] = cleaned === '' ? undefined : cleaned;
  }
  return out;
}

/** Cross-field reconciliation. Never throws. */
function reconcile(env: Env, source: Record<string, string | undefined>): Env {
  let next = env;

  // Hosted deploys cannot reach a laptop's Supabase. A localhost URL here is
  // almost always a copy-paste from `supabase start` into the Vercel dashboard;
  // auth.getUser() then hangs/fails and 500s dynamic routes.
  if (next.NEXT_PUBLIC_SUPABASE_URL && isHostedRuntime(source)) {
    try {
      const host = new URL(next.NEXT_PUBLIC_SUPABASE_URL).hostname;
      if (isLoopbackHost(host)) {
        diagnostics.supabaseLoopbackRejected = true;
        diagnostics.liveDowngraded = true;
        diagnostics.warnings.push(
          `NEXT_PUBLIC_SUPABASE_URL points at ${host} which is unreachable from this host — cleared (use your https://*.supabase.co project URL)`,
        );
        // eslint-disable-next-line no-console
        console.warn(
          `[config] Rejecting loopback Supabase URL (${host}) on hosted runtime. Set NEXT_PUBLIC_SUPABASE_URL to your cloud project.`,
        );
        next = {
          ...next,
          NEXT_PUBLIC_SUPABASE_URL: undefined,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
          SUPABASE_SERVICE_ROLE_KEY: undefined,
          DATA_MODE: 'demo',
        };
      }
    } catch {
      // Invalid URL already handled by schema; ignore.
    }
  }

  if (
    next.DATA_MODE === 'live' &&
    (!next.NEXT_PUBLIC_SUPABASE_URL || !next.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ) {
    diagnostics.liveDowngraded = true;
    diagnostics.warnings.push(
      'DATA_MODE=live downgraded to demo: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing or invalid',
    );
    // eslint-disable-next-line no-console
    console.warn(
      '[config] DATA_MODE=live but Supabase env is missing/invalid — falling back to demo mode.',
    );
    next = { ...next, DATA_MODE: 'demo' };
  }
  return next;
}

let cached: Env | null = null;

/**
 * Parse the environment. NEVER throws: invalid fields are dropped to their
 * defaults and recorded in diagnostics. A misconfigured deploy must render
 * pages (degraded, observable), not 500 the whole site.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  if (cached) return cached;
  diagnostics.droppedKeys = [];
  diagnostics.warnings = [];
  diagnostics.liveDowngraded = false;
  diagnostics.supabaseLoopbackRejected = false;

  const sanitized = sanitizeSource(source);
  let parsed = envSchema.safeParse(sanitized);

  if (!parsed.success) {
    // Drop each offending field to its default rather than failing the boot.
    const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
    for (const key of bad) {
      diagnostics.droppedKeys.push(key);
      diagnostics.warnings.push(`${key}: invalid value dropped (using default)`);
      delete sanitized[key];
    }
    // eslint-disable-next-line no-console
    console.warn(`[config] Dropped invalid env values for: ${[...bad].join(', ')}`);
    parsed = envSchema.safeParse(sanitized);
  }

  // Last resort: pure defaults. envSchema.parse({}) cannot fail (all fields
  // optional or defaulted), so the app always boots.
  cached = reconcile(parsed.success ? parsed.data : envSchema.parse({}), source);
  return cached;
}

/** Names-only diagnostics for the health endpoint. Never contains values. */
export function getEnvDiagnostics(): EnvDiagnostics {
  return {
    ...diagnostics,
    droppedKeys: [...diagnostics.droppedKeys],
    warnings: [...diagnostics.warnings],
  };
}

/** Test-only: reset the memoized env. */
export function __resetEnvCache(): void {
  cached = null;
}

export const isDemoMode = (env: Env): boolean => env.DATA_MODE === 'demo';
