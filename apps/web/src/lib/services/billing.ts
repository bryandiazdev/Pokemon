import 'server-only';
import Stripe from 'stripe';
import {
  PLAN_DEFAULTS,
  planForPriceId,
  priceIdFor,
  statusGrantsPaidAccess,
  type PaidPlanKey,
  type PlanTier,
} from '@psr/config';
import { env, hasStripe } from '../env';
import { getAdminSupabase } from '../supabase/admin';

/**
 * Stripe billing service — all secret-key operations live server-side here.
 *
 * Design decisions (see docs/STRIPE_BILLING.md):
 * - Checkout accepts only {plan, interval} against the server allowlist in
 *   @psr/config; price IDs never come from the client.
 * - One Stripe customer per user, stored on profiles.stripe_customer_id and
 *   reused across attempts, so retried checkouts can't mint duplicates.
 * - A user with an active/trialing subscription is sent to the Billing Portal
 *   for plan changes instead of a second Checkout (prevents double-billing;
 *   the portal handles proration for upgrades/downgrades/interval switches).
 * - The webhook is the source of truth: it upserts `subscriptions` and syncs
 *   the per-user `entitlements` row from the plan catalog.
 */

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!hasStripe) return null;
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(env.STRIPE_SECRET_KEY!);
  }
  return stripeSingleton;
}

// ---------- Customer management ----------

/** Fetch (or create + persist) the Stripe customer for a user. */
export async function getOrCreateCustomer(
  stripe: Stripe,
  user: { id: string; email: string },
): Promise<string> {
  const supabase = getAdminSupabase();
  if (supabase) {
    const { data } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();
    const existing = data?.stripe_customer_id as string | null | undefined;
    if (existing) return existing;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id },
  });
  if (supabase) {
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customer.id })
      .eq('id', user.id);
  }
  return customer.id;
}

/** Does this customer already have a subscription that grants (or will grant) access? */
export async function findActiveSubscription(
  stripe: Stripe,
  customerId: string,
): Promise<Stripe.Subscription | null> {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
  return (
    subs.data.find((s) =>
      ['active', 'trialing', 'past_due', 'incomplete'].includes(s.status),
    ) ?? null
  );
}

// ---------- Checkout ----------

export interface CheckoutParams {
  user: { id: string; email: string };
  key: PaidPlanKey;
  successUrl: string;
  cancelUrl: string;
}

export type CheckoutOutcome =
  | { kind: 'checkout'; url: string }
  | { kind: 'portal'; url: string }
  | { kind: 'mock'; url: string }
  | { kind: 'error'; message: string };

export async function startCheckout(params: CheckoutParams): Promise<CheckoutOutcome> {
  const stripe = getStripe();
  const priceId = priceIdFor(env, params.key);

  if (!stripe || !priceId) {
    // Mock mode — no Stripe configured; exercisable flow, no charge, no access.
    return { kind: 'mock', url: `${params.successUrl}${params.successUrl.includes('?') ? '&' : '?'}mock=1` };
  }

  const customerId = await getOrCreateCustomer(stripe, params.user);

  // Existing paid subscriber → Billing Portal, never a second subscription.
  const existing = await findActiveSubscription(stripe, customerId);
  if (existing && existing.status !== 'incomplete') {
    const portal = await createPortalSession(customerId, params.successUrl);
    if (portal) return { kind: 'portal', url: portal };
    return { kind: 'error', message: 'You already have a subscription — manage it from your account page.' };
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: params.user.id,
    metadata: { userId: params.user.id, plan: params.key.plan, interval: params.key.interval },
    subscription_data: {
      metadata: { userId: params.user.id, plan: params.key.plan, interval: params.key.interval },
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: true,
  });
  if (!session.url) return { kind: 'error', message: 'Stripe did not return a checkout URL.' };
  return { kind: 'checkout', url: session.url };
}

// ---------- Billing Portal ----------

export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    ...(env.STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID
      ? { configuration: env.STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID }
      : {}),
  });
  return session.url;
}

// ---------- Webhook verification ----------

export function constructWebhookEvent(payload: string, signature: string): Stripe.Event | null {
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) return null;
  try {
    return stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return null;
  }
}

// ---------- Subscription state sync (webhook is the source of truth) ----------

type AdminClient = NonNullable<ReturnType<typeof getAdminSupabase>>;

/** Resolve our user id for a subscription: metadata first, then customer id. */
export async function resolveUserId(
  supabase: AdminClient,
  sub: Stripe.Subscription,
): Promise<string | null> {
  const fromMeta = sub.metadata?.userId;
  if (fromMeta) return fromMeta;
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', String(sub.customer))
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** The plan a subscription's state entitles the user to right now. */
export function effectivePlan(sub: Stripe.Subscription): PlanTier {
  if (!statusGrantsPaidAccess(sub.status)) return 'free';
  const key = planForPriceId(env, sub.items.data[0]?.price?.id);
  return key?.plan ?? 'free';
}

/**
 * Upsert the subscription row and sync the user's entitlements row from the
 * plan catalog. Data is always preserved on downgrade — only limits change.
 */
export async function syncSubscription(
  supabase: AdminClient,
  sub: Stripe.Subscription,
): Promise<void> {
  const userId = await resolveUserId(supabase, sub);
  if (!userId) {
    // eslint-disable-next-line no-console
    console.error(`[billing] cannot resolve user for subscription ${sub.id}`);
    return;
  }

  // Keep the customer linkage current (covers customers created by Stripe).
  await supabase
    .from('profiles')
    .update({ stripe_customer_id: String(sub.customer) })
    .eq('id', userId)
    .is('stripe_customer_id', null);

  const item = sub.items.data[0];
  await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: String(sub.customer),
      stripe_subscription_id: sub.id,
      stripe_price_id: item?.price?.id ?? null,
      status: sub.status,
      current_period_start: sub.current_period_start
        ? new Date(sub.current_period_start * 1000).toISOString()
        : null,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    },
    { onConflict: 'stripe_subscription_id' },
  );

  await applyPlanEntitlements(supabase, userId, effectivePlan(sub));
}

/** Write catalog defaults for a plan onto the user's entitlements row. */
export async function applyPlanEntitlements(
  supabase: AdminClient,
  userId: string,
  plan: PlanTier,
): Promise<void> {
  const e = PLAN_DEFAULTS[plan];
  await supabase.from('entitlements').upsert(
    {
      user_id: userId,
      plan,
      collection_limit: e.collectionLimit,
      quick_scan_monthly_limit: e.quickScanMonthlyLimit,
      grade_scan_monthly_limit: e.gradeScanMonthlyLimit,
      alerts_limit: e.alertsLimit,
      history_days: e.historyDays,
      exports_enabled: e.exportsEnabled,
      advanced_analytics_enabled: e.advancedAnalyticsEnabled,
      batch_scanning_enabled: e.batchScanningEnabled,
    },
    { onConflict: 'user_id' },
  );
}

// ---------- Account-page subscription summary ----------

export interface SubscriptionSummary {
  plan: PlanTier;
  status: string | null;
  interval: 'month' | 'year' | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  paidAccess: boolean;
}

export async function getSubscriptionSummary(userId: string): Promise<SubscriptionSummary> {
  const supabase = getAdminSupabase();
  const base: SubscriptionSummary = {
    plan: 'free',
    status: null,
    interval: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    hasStripeCustomer: false,
    paidAccess: false,
  };
  if (!supabase) return base;

  const [{ data: profile }, { data: sub }, { data: ent }] = await Promise.all([
    supabase.from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle(),
    supabase
      .from('subscriptions')
      .select('stripe_price_id, status, current_period_end, cancel_at_period_end')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('entitlements').select('plan').eq('user_id', userId).maybeSingle(),
  ]);

  const key = planForPriceId(env, sub?.stripe_price_id as string | undefined);
  const status = (sub?.status as string | undefined) ?? null;
  const paid = status !== null && statusGrantsPaidAccess(status);
  const entPlanRaw = (ent?.plan as string | undefined) ?? 'free';
  const entPlan: PlanTier =
    entPlanRaw === 'collector_pro' ? 'collector' : (entPlanRaw as PlanTier);
  return {
    plan: paid ? (key?.plan ?? entPlan) : 'free',
    status,
    interval: key?.interval ?? null,
    currentPeriodEnd: (sub?.current_period_end as string | undefined) ?? null,
    cancelAtPeriodEnd: Boolean(sub?.cancel_at_period_end),
    hasStripeCustomer: Boolean(profile?.stripe_customer_id),
    paidAccess: paid,
  };
}

export async function getCustomerIdForUser(userId: string): Promise<string | null> {
  const supabase = getAdminSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();
  return (data?.stripe_customer_id as string | null | undefined) ?? null;
}
