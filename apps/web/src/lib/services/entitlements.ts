import 'server-only';
import {
  FREE_ENTITLEMENTS,
  COLLECTOR_PRO_ENTITLEMENTS,
  resolveLimit,
  type Entitlements,
} from '@psr/config';

/**
 * Server-authoritative entitlement checks. Client subscription state is NEVER
 * trusted. In live mode these read the `entitlements` + `usage_periods` tables
 * (source of truth); in demo mode they use plan defaults for the demo user.
 */

export interface UsageSnapshot {
  quickScansUsed: number;
  gradeScansUsed: number;
  activeAlerts: number;
  collectionItems: number;
}

export interface EntitlementContext {
  entitlements: Entitlements;
  usage: UsageSnapshot;
}

/** Demo default: the demo user is on Collector Pro so all features are visible. */
export async function getEntitlementContext(
  plan: 'free' | 'collector_pro' = 'collector_pro',
): Promise<EntitlementContext> {
  const entitlements = plan === 'collector_pro' ? COLLECTOR_PRO_ENTITLEMENTS : FREE_ENTITLEMENTS;
  return {
    entitlements,
    usage: { quickScansUsed: 12, gradeScansUsed: 1, activeAlerts: 2, collectionItems: 3 },
  };
}

export type GateResult =
  | { allowed: true; remaining: number | null }
  | { allowed: false; reason: 'usage_limit_reached' | 'entitlement_exceeded'; message: string };

export function checkQuickScan(ctx: EntitlementContext): GateResult {
  return checkMeter(
    ctx.entitlements.quickScanMonthlyLimit,
    ctx.usage.quickScansUsed,
    'quick scans',
  );
}

export function checkGradeScan(ctx: EntitlementContext): GateResult {
  return checkMeter(
    ctx.entitlements.gradeScanMonthlyLimit,
    ctx.usage.gradeScansUsed,
    'grade scans',
  );
}

export function checkAlertCreate(ctx: EntitlementContext): GateResult {
  return checkMeter(ctx.entitlements.alertsLimit, ctx.usage.activeAlerts, 'alerts', 'entitlement_exceeded');
}

export function checkCollectionAdd(ctx: EntitlementContext): GateResult {
  return checkMeter(
    ctx.entitlements.collectionLimit,
    ctx.usage.collectionItems,
    'collection items',
    'entitlement_exceeded',
  );
}

function checkMeter(
  limit: number,
  used: number,
  noun: string,
  reason: 'usage_limit_reached' | 'entitlement_exceeded' = 'usage_limit_reached',
): GateResult {
  const { unlimited, value } = resolveLimit(limit);
  if (unlimited) return { allowed: true, remaining: null };
  if (used >= value) {
    return {
      allowed: false,
      reason,
      message: `You've reached your ${noun} limit for this plan. Upgrade or wait for your next billing period.`,
    };
  }
  return { allowed: true, remaining: value - used };
}

export function remainingLabel(limit: number, used: number): string {
  const { unlimited, value } = resolveLimit(limit);
  if (unlimited) return 'Unlimited';
  return `${Math.max(0, value - used)} of ${value} left`;
}
