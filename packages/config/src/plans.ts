/**
 * Centralized plan catalog — the single source of truth for plans, pricing,
 * entitlements, and Stripe price mapping.
 *
 * Tiers: free → collector → pro. Paid tiers bill monthly or annually.
 * The values here are *bootstrap defaults*: at runtime the per-user
 * `entitlements` table is authoritative (synced from this catalog by the
 * Stripe webhook), so limits can be adjusted per-user without a deploy.
 * Use -1 for "unlimited".
 *
 * Do NOT compare Stripe price IDs anywhere else in the codebase — resolve
 * them through `planForPriceId()` / `priceIdFor()` so price changes stay a
 * configuration concern.
 */

export const UNLIMITED = -1 as const;

export type PlanTier = 'free' | 'collector' | 'pro';
export type BillingInterval = 'month' | 'year';

export interface Entitlements {
  plan: PlanTier;
  collectionLimit: number; // -1 = unlimited
  quickScanMonthlyLimit: number;
  gradeScanMonthlyLimit: number; // AI grade checks
  alertsLimit: number;
  historyDays: number; // -1 = all available
  exportsEnabled: boolean;
  advancedAnalyticsEnabled: boolean;
  batchScanningEnabled: boolean;
}

export const FREE_ENTITLEMENTS: Entitlements = {
  plan: 'free',
  collectionLimit: 100,
  quickScanMonthlyLimit: 25,
  gradeScanMonthlyLimit: 0, // AI grade checks are a Pro feature
  alertsLimit: 0,
  historyDays: 30,
  exportsEnabled: false,
  advancedAnalyticsEnabled: false,
  batchScanningEnabled: false,
};

export const COLLECTOR_ENTITLEMENTS: Entitlements = {
  plan: 'collector',
  collectionLimit: UNLIMITED, // subject to the abuse ceiling below
  quickScanMonthlyLimit: 500,
  gradeScanMonthlyLimit: 0, // AI grade checks remain Pro-only
  alertsLimit: 25,
  historyDays: UNLIMITED,
  exportsEnabled: true,
  advancedAnalyticsEnabled: true,
  batchScanningEnabled: false,
};

export const PRO_ENTITLEMENTS: Entitlements = {
  plan: 'pro',
  collectionLimit: UNLIMITED,
  quickScanMonthlyLimit: 2000,
  gradeScanMonthlyLimit: 30,
  alertsLimit: 250,
  historyDays: UNLIMITED,
  exportsEnabled: true,
  advancedAnalyticsEnabled: true,
  batchScanningEnabled: true,
};

export const PLAN_DEFAULTS: Record<PlanTier, Entitlements> = {
  free: FREE_ENTITLEMENTS,
  collector: COLLECTOR_ENTITLEMENTS,
  pro: PRO_ENTITLEMENTS,
};

/** Ordering for upgrade/downgrade comparisons. */
export const PLAN_ORDER: Record<PlanTier, number> = { free: 0, collector: 1, pro: 2 };

/**
 * Display pricing in integer minor units (cents). Stripe remains the billing
 * source of truth; these MUST match the configured Stripe prices — the docs
 * in docs/STRIPE_BILLING.md walk through creating them.
 */
export const PLAN_PRICING = {
  collector: { month: 799, year: 7900, currency: 'USD' },
  pro: { month: 1999, year: 19900, currency: 'USD' },
} as const;

/** Accurate annual-savings percentage vs 12 months of monthly billing. */
export function annualSavingsPct(plan: 'collector' | 'pro'): number {
  const p = PLAN_PRICING[plan];
  const yearOfMonthly = p.month * 12;
  return Math.round(((yearOfMonthly - p.year) / yearOfMonthly) * 100);
}

export interface PaidPlanKey {
  plan: 'collector' | 'pro';
  interval: BillingInterval;
}

/** Env var name that holds each Stripe price ID (server-configured). */
export const PRICE_ENV_KEYS: Record<'collector' | 'pro', Record<BillingInterval, string>> = {
  collector: {
    month: 'STRIPE_COLLECTOR_MONTHLY_PRICE_ID',
    year: 'STRIPE_COLLECTOR_ANNUAL_PRICE_ID',
  },
  pro: {
    month: 'STRIPE_PRO_MONTHLY_PRICE_ID',
    year: 'STRIPE_PRO_ANNUAL_PRICE_ID',
  },
};

export interface PriceIdEnv {
  STRIPE_COLLECTOR_MONTHLY_PRICE_ID?: string;
  STRIPE_COLLECTOR_ANNUAL_PRICE_ID?: string;
  STRIPE_PRO_MONTHLY_PRICE_ID?: string;
  STRIPE_PRO_ANNUAL_PRICE_ID?: string;
}

/** Server-maintained allowlist: the ONLY prices checkout will ever use. */
export function priceIdFor(env: PriceIdEnv, key: PaidPlanKey): string | undefined {
  const name = PRICE_ENV_KEYS[key.plan][key.interval] as keyof PriceIdEnv;
  return env[name];
}

/** Reverse mapping: which plan/interval does a Stripe price ID belong to? */
export function planForPriceId(
  env: PriceIdEnv,
  priceId: string | null | undefined,
): PaidPlanKey | null {
  if (!priceId) return null;
  for (const plan of ['collector', 'pro'] as const) {
    for (const interval of ['month', 'year'] as const) {
      if (priceIdFor(env, { plan, interval }) === priceId) return { plan, interval };
    }
  }
  return null;
}

/**
 * Which Stripe subscription statuses grant paid access.
 * Decision: `past_due` keeps access as a GRACE PERIOD — Stripe retries the
 * payment for days and a hard cut on the first failed card charge is hostile;
 * the UI shows a billing warning instead. `unpaid` (retries exhausted) and
 * everything else revert to free.
 */
export function statusGrantsPaidAccess(status: string): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

/** Abuse-protection ceiling even for "unlimited" collections. */
export const ABUSE_COLLECTION_HARD_CAP = 250_000;

export function resolveLimit(limit: number): { unlimited: boolean; value: number } {
  return limit === UNLIMITED
    ? { unlimited: true, value: Infinity }
    : { unlimited: false, value: limit };
}
