/**
 * Plan entitlement DEFAULTS.
 *
 * These are only the *bootstrap defaults* used when provisioning a user or
 * seeding the DB. The source of truth at runtime is the `entitlements` table,
 * so limits can change per-user or globally WITHOUT a code deploy. Use `-1` for
 * "unlimited".
 */

export const UNLIMITED = -1 as const;

export interface Entitlements {
  plan: 'free' | 'collector_pro';
  collectionLimit: number; // -1 = unlimited
  quickScanMonthlyLimit: number;
  gradeScanMonthlyLimit: number;
  alertsLimit: number;
  historyDays: number; // -1 = all available
  exportsEnabled: boolean;
  advancedAnalyticsEnabled: boolean;
  batchScanningEnabled: boolean;
}

export const FREE_ENTITLEMENTS: Entitlements = {
  plan: 'free',
  collectionLimit: 50,
  quickScanMonthlyLimit: 10,
  gradeScanMonthlyLimit: 1,
  alertsLimit: 3,
  historyDays: 30,
  exportsEnabled: false,
  advancedAnalyticsEnabled: false,
  batchScanningEnabled: false,
};

export const COLLECTOR_PRO_ENTITLEMENTS: Entitlements = {
  plan: 'collector_pro',
  collectionLimit: UNLIMITED, // subject to abuse protection at the service layer
  quickScanMonthlyLimit: 100,
  gradeScanMonthlyLimit: 10,
  alertsLimit: 100,
  historyDays: UNLIMITED,
  exportsEnabled: true,
  advancedAnalyticsEnabled: true,
  batchScanningEnabled: true,
};

export const PLAN_DEFAULTS: Record<Entitlements['plan'], Entitlements> = {
  free: FREE_ENTITLEMENTS,
  collector_pro: COLLECTOR_PRO_ENTITLEMENTS,
};

/** Marketing pricing shown on the pricing page (Stripe is the source of truth). */
export const PRICING = {
  collectorPro: {
    monthly: { amountMinor: 499, currency: 'USD', interval: 'month' as const },
    annualNote: 'Annual pricing is configured in Stripe.',
  },
};

/** Abuse-protection ceiling even for "unlimited" collections. */
export const ABUSE_COLLECTION_HARD_CAP = 250_000;

export function resolveLimit(limit: number): { unlimited: boolean; value: number } {
  return limit === UNLIMITED ? { unlimited: true, value: Infinity } : { unlimited: false, value: limit };
}
