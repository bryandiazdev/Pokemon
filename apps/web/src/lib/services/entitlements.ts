import 'server-only';
import {
  PLAN_DEFAULTS,
  FREE_ENTITLEMENTS,
  PRO_ENTITLEMENTS,
  resolveLimit,
  type Entitlements,
  type PlanTier,
} from '@psr/config';
import { env, hasSupabase } from '../env';
import { getCurrentUser } from '../auth';
import { getAdminSupabase } from '../supabase/admin';

/**
 * Server-authoritative entitlements + usage. Client subscription state is
 * NEVER trusted. Live mode reads the per-user `entitlements` row (synced from
 * the plan catalog by the Stripe webhook) plus real usage; demo mode (no
 * Supabase) shows the full product on Pro-shaped defaults with sample usage.
 *
 * Metering decision (documented for reviewers): quota'd operations RESERVE a
 * unit atomically before the expensive work (single conditional UPDATE via the
 * consume_usage SQL function — two concurrent requests can never both pass at
 * limit-1) and REFUND with release_usage when the operation fails, so users
 * are never charged quota for our failures and cannot race past a limit.
 */

export type UsageMetric = 'quick_scan' | 'grade_scan';

export interface UsageSnapshot {
  quickScansUsed: number;
  gradeScansUsed: number;
  activeAlerts: number;
  collectionItems: number;
}

export interface EntitlementContext {
  userId: string | null;
  isDemo: boolean;
  entitlements: Entitlements;
  usage: UsageSnapshot;
}

const DEMO_USAGE: UsageSnapshot = {
  quickScansUsed: 12,
  gradeScansUsed: 1,
  activeAlerts: 2,
  collectionItems: 3,
};

export async function getEntitlementContext(): Promise<EntitlementContext> {
  const user = await getCurrentUser();

  // Keyless demo install: the whole product is explorable on Pro-shaped
  // defaults with sample usage (nothing is persisted or billed).
  if (!hasSupabase) {
    return {
      userId: user?.id ?? null,
      isDemo: true,
      entitlements: PRO_ENTITLEMENTS,
      usage: DEMO_USAGE,
    };
  }

  // Live deployment, signed OUT: visitors can try the core product on
  // Free-shaped limits (scans allowed, paid features gated). Nothing is
  // metered without an identity; expensive AI features are 0-limited anyway.
  if (!user || user.isDemo) {
    return {
      userId: null,
      isDemo: true,
      entitlements: FREE_ENTITLEMENTS,
      usage: EMPTY_USAGE,
    };
  }

  // Explicit dev-only override (never honored in production builds).
  if (env.NODE_ENV === 'development' && env.DEV_BILLING_PLAN_OVERRIDE) {
    return {
      userId: user.id,
      isDemo: false,
      entitlements: PLAN_DEFAULTS[env.DEV_BILLING_PLAN_OVERRIDE as PlanTier],
      usage: await readUsage(user.id),
    };
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    // Misconfigured service role: fail CLOSED to free, not open to pro.
    return { userId: user.id, isDemo: false, entitlements: FREE_ENTITLEMENTS, usage: EMPTY_USAGE };
  }

  const { data: row } = await supabase
    .from('entitlements')
    .select(
      'plan, collection_limit, quick_scan_monthly_limit, grade_scan_monthly_limit, alerts_limit, history_days, exports_enabled, advanced_analytics_enabled, batch_scanning_enabled',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  const entitlements: Entitlements = row
    ? {
        plan: normalizePlan(row.plan as string),
        collectionLimit: row.collection_limit as number,
        quickScanMonthlyLimit: row.quick_scan_monthly_limit as number,
        gradeScanMonthlyLimit: row.grade_scan_monthly_limit as number,
        alertsLimit: row.alerts_limit as number,
        historyDays: row.history_days as number,
        exportsEnabled: Boolean(row.exports_enabled),
        advancedAnalyticsEnabled: Boolean(row.advanced_analytics_enabled),
        batchScanningEnabled: Boolean(row.batch_scanning_enabled),
      }
    : FREE_ENTITLEMENTS;

  return { userId: user.id, isDemo: false, entitlements, usage: await readUsage(user.id) };
}

const EMPTY_USAGE: UsageSnapshot = {
  quickScansUsed: 0,
  gradeScansUsed: 0,
  activeAlerts: 0,
  collectionItems: 0,
};

/** Legacy tier name maps to its successor. */
function normalizePlan(plan: string): PlanTier {
  if (plan === 'collector_pro') return 'collector';
  if (plan === 'collector' || plan === 'pro' || plan === 'free') return plan;
  return 'free';
}

async function readUsage(userId: string): Promise<UsageSnapshot> {
  const supabase = getAdminSupabase();
  if (!supabase) return EMPTY_USAGE;
  const [usageRes, alertsRes, itemsRes] = await Promise.all([
    supabase.rpc('current_usage', { p_user_id: userId }).maybeSingle(),
    supabase
      .from('price_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('collection_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);
  const u = (usageRes.data ?? {}) as { quick_scans_used?: number; grade_scans_used?: number };
  return {
    quickScansUsed: u.quick_scans_used ?? 0,
    gradeScansUsed: u.grade_scans_used ?? 0,
    activeAlerts: alertsRes.count ?? 0,
    collectionItems: itemsRes.count ?? 0,
  };
}

// ---------- Gate results (structured paywall payloads, never bare 500s) ----------

export interface GateDenied {
  allowed: false;
  reason: 'usage_limit_reached' | 'entitlement_exceeded' | 'subscription_required';
  message: string;
  /** For the client paywall UI. */
  paywall: {
    plan: PlanTier;
    metric: string;
    used: number;
    limit: number | null;
    recommendedPlan: PlanTier;
  };
}

export type GateResult = { allowed: true; remaining: number | null } | GateDenied;

function denied(
  reason: GateDenied['reason'],
  message: string,
  paywall: GateDenied['paywall'],
): GateDenied {
  return { allowed: false, reason, message, paywall };
}

export function checkQuickScan(ctx: EntitlementContext): GateResult {
  const { unlimited, value } = resolveLimit(ctx.entitlements.quickScanMonthlyLimit);
  if (unlimited) return { allowed: true, remaining: null };
  if (ctx.usage.quickScansUsed >= value) {
    const rec = ctx.entitlements.plan === 'free' ? 'collector' : 'pro';
    return denied(
      'usage_limit_reached',
      ctx.entitlements.plan === 'free'
        ? `You've used all ${value} free scans this month. Upgrade to Collector for up to 500 monthly scans.`
        : `You've used all ${value} scans this month. ${ctx.entitlements.plan === 'collector' ? 'Pro includes up to 2,000.' : `Your allowance resets next month.`}`,
      {
        plan: ctx.entitlements.plan,
        metric: 'quick_scan',
        used: ctx.usage.quickScansUsed,
        limit: value,
        recommendedPlan: ctx.entitlements.plan === 'pro' ? 'pro' : rec,
      },
    );
  }
  return { allowed: true, remaining: value - ctx.usage.quickScansUsed };
}

export function checkGradeScan(ctx: EntitlementContext): GateResult {
  const { unlimited, value } = resolveLimit(ctx.entitlements.gradeScanMonthlyLimit);
  if (unlimited) return { allowed: true, remaining: null };
  if (value === 0) {
    return denied('subscription_required', 'AI Grade Check is available on Pro.', {
      plan: ctx.entitlements.plan,
      metric: 'grade_scan',
      used: 0,
      limit: 0,
      recommendedPlan: 'pro',
    });
  }
  if (ctx.usage.gradeScansUsed >= value) {
    return denied(
      'usage_limit_reached',
      `You've used all ${value} AI grade checks this month. Your allowance resets at the start of next month (UTC).`,
      {
        plan: ctx.entitlements.plan,
        metric: 'grade_scan',
        used: ctx.usage.gradeScansUsed,
        limit: value,
        recommendedPlan: 'pro',
      },
    );
  }
  return { allowed: true, remaining: value - ctx.usage.gradeScansUsed };
}

export function checkAlertCreate(ctx: EntitlementContext): GateResult {
  const { unlimited, value } = resolveLimit(ctx.entitlements.alertsLimit);
  if (unlimited) return { allowed: true, remaining: null };
  if (value === 0) {
    return denied('subscription_required', 'Create custom price alerts with Collector.', {
      plan: ctx.entitlements.plan,
      metric: 'price_alert',
      used: ctx.usage.activeAlerts,
      limit: 0,
      recommendedPlan: 'collector',
    });
  }
  if (ctx.usage.activeAlerts >= value) {
    return denied(
      'entitlement_exceeded',
      `Your plan supports up to ${value} active alerts. ${ctx.entitlements.plan === 'collector' ? 'Pro raises this to 250.' : 'Remove an alert to add another.'}`,
      {
        plan: ctx.entitlements.plan,
        metric: 'price_alert',
        used: ctx.usage.activeAlerts,
        limit: value,
        recommendedPlan: ctx.entitlements.plan === 'collector' ? 'pro' : 'collector',
      },
    );
  }
  return { allowed: true, remaining: value - ctx.usage.activeAlerts };
}

export function checkCollectionAdd(ctx: EntitlementContext): GateResult {
  const { unlimited, value } = resolveLimit(ctx.entitlements.collectionLimit);
  if (unlimited) return { allowed: true, remaining: null };
  if (ctx.usage.collectionItems >= value) {
    return denied(
      'entitlement_exceeded',
      `Your ${ctx.entitlements.plan === 'free' ? 'Free plan' : 'plan'} supports up to ${value} collection cards. Upgrade to Collector for unlimited collection tracking. Your existing cards stay safe and viewable.`,
      {
        plan: ctx.entitlements.plan,
        metric: 'collection_card',
        used: ctx.usage.collectionItems,
        limit: value,
        recommendedPlan: 'collector',
      },
    );
  }
  return { allowed: true, remaining: value - ctx.usage.collectionItems };
}

export function checkExport(ctx: EntitlementContext): GateResult {
  if (ctx.entitlements.exportsEnabled) return { allowed: true, remaining: null };
  return denied('subscription_required', 'Collection exports are available on Collector and Pro.', {
    plan: ctx.entitlements.plan,
    metric: 'export',
    used: 0,
    limit: 0,
    recommendedPlan: 'collector',
  });
}

// ---------- Atomic usage consumption (reserve → refund on failure) ----------

export interface ConsumeResult {
  allowed: boolean;
  current: number;
  limit: number | null;
  remaining: number | null;
  /**
   * True when metering INFRASTRUCTURE failed (RPC missing/unreachable) rather
   * than the user being over quota. Callers must never present this as
   * "you've used all your scans" — that fabricates a quota claim.
   */
  infraFailure?: boolean;
}

/**
 * Atomically reserve one unit of a metric for the current UTC month.
 * Demo/dev contexts consume nothing and always allow.
 */
export async function consumeUsage(
  ctx: EntitlementContext,
  metric: UsageMetric,
): Promise<ConsumeResult> {
  const limitRaw =
    metric === 'quick_scan'
      ? ctx.entitlements.quickScanMonthlyLimit
      : ctx.entitlements.gradeScanMonthlyLimit;
  const { unlimited, value } = resolveLimit(limitRaw);

  if (ctx.isDemo || !ctx.userId) {
    return { allowed: true, current: 0, limit: unlimited ? null : value, remaining: null };
  }
  const supabase = getAdminSupabase();
  const limit = unlimited ? null : value;
  if (!supabase) {
    return { allowed: true, current: 0, limit, remaining: null, infraFailure: true };
  }

  const { data, error } = await supabase
    .rpc('consume_usage', { p_user_id: ctx.userId, p_metric: metric, p_limit: limitRaw })
    .maybeSingle();
  if (error || !data) {
    // Metering infrastructure failure (e.g. migration not yet applied):
    // FAIL OPEN, loudly. The pre-flight check* gate already enforced the
    // limit against best-available usage data, so the only exposure is
    // uncounted usage during the outage — bricking the core product (and
    // fabricating "quota exhausted" messages) is far worse. Decision
    // documented here on purpose.
    // eslint-disable-next-line no-console
    console.error(
      `[entitlements] consume_usage(${metric}) infrastructure failure — usage NOT counted:`,
      error?.message,
    );
    return { allowed: true, current: 0, limit, remaining: null, infraFailure: true };
  }
  const row = data as { allowed: boolean; current_count: number };
  return {
    allowed: row.allowed,
    current: row.current_count,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - row.current_count),
  };
}

/** Refund a reservation after the metered operation failed. */
export async function releaseUsage(ctx: EntitlementContext, metric: UsageMetric): Promise<void> {
  if (ctx.isDemo || !ctx.userId) return;
  const supabase = getAdminSupabase();
  if (!supabase) return;
  await supabase.rpc('release_usage', { p_user_id: ctx.userId, p_metric: metric });
}

export function remainingLabel(limit: number, used: number): string {
  const { unlimited, value } = resolveLimit(limit);
  if (unlimited) return 'Unlimited';
  return `${Math.max(0, value - used)} of ${value} left`;
}
