import Link from 'next/link';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCurrentUser } from '@/lib/auth';
import { getEntitlementContext } from '@/lib/services/entitlements';
import { getSubscriptionSummary, type SubscriptionSummary } from '@/lib/services/billing';
import { UsageMeter } from '@/components/billing/usage-meter';
import { ManageBillingButton } from '@/components/billing/manage-billing-button';
import { UpgradeButton, DataControls } from './account-actions';
import { hasStripe, hasSupabase } from '@/lib/env';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export const metadata = { title: 'Account' };
export const dynamic = 'force-dynamic';

const PLAN_LABEL: Record<string, string> = { free: 'Free', collector: 'Collector', pro: 'Pro' };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const [{ upgraded }, user, ctx] = await Promise.all([
    searchParams,
    getCurrentUser(),
    getEntitlementContext(),
  ]);
  const e = ctx.entitlements;

  let sub: SubscriptionSummary | null = null;
  if (user && !user.isDemo && hasSupabase) {
    sub = await getSubscriptionSummary(user.id);
  }
  const plan = sub?.plan ?? e.plan;
  const paymentTrouble = sub?.status === 'past_due' || sub?.status === 'unpaid';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="font-display text-2xl font-semibold">Account</h1>

      {upgraded === '1' && (
        <div className="flex items-start gap-2 rounded-lg border border-positive/30 bg-positive/10 px-3 py-2.5 text-sm text-positive">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Checkout complete — thank you! Your plan activates as soon as Stripe confirms the
            payment (usually within seconds). If this page still shows your old plan, refresh in a
            moment.
          </span>
        </div>
      )}

      {paymentTrouble && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Your last payment didn&apos;t go through.{' '}
            {sub?.status === 'past_due'
              ? 'Your benefits continue for now while Stripe retries — update your payment method to keep them.'
              : 'Paid features are paused until the payment method is updated.'}
          </span>
        </div>
      )}

      <Card>
        <CardTitle>Profile</CardTitle>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Name" value={user?.displayName ?? '—'} />
          <Row label="Email" value={user?.email ?? '—'} />
          {user?.isDemo && (
            <div className="pt-1">
              <Badge tone="demo">Demo account</Badge>
            </div>
          )}
        </dl>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Plan &amp; billing</CardTitle>
          <div className="flex items-center gap-2">
            <Badge tone={plan === 'pro' ? 'demo' : plan === 'collector' ? 'gold' : 'neutral'}>
              {PLAN_LABEL[plan] ?? plan}
            </Badge>
            {sub?.interval && <Badge tone="neutral">{sub.interval === 'year' ? 'Annual' : 'Monthly'}</Badge>}
            {sub?.status && sub.status !== 'active' && <Badge tone="warning">{sub.status}</Badge>}
          </div>
        </div>

        {sub?.currentPeriodEnd && (
          <p className="mt-2 text-sm text-muted">
            {sub.cancelAtPeriodEnd
              ? `Cancellation scheduled — your ${PLAN_LABEL[plan]} benefits continue until ${fmtDate(sub.currentPeriodEnd)}, then your account moves to Free. Your collection is never deleted; if it's over the Free limit it stays viewable and you can't add more until you upgrade or trim it.`
              : `Renews ${fmtDate(sub.currentPeriodEnd)}.`}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <UsageMeter label="Card scans" used={ctx.usage.quickScansUsed} limit={e.quickScanMonthlyLimit} />
          </div>
          <div className="rounded-lg border border-border p-3">
            <UsageMeter
              label="AI grade checks"
              used={ctx.usage.gradeScansUsed}
              limit={e.gradeScanMonthlyLimit}
              zeroLimitHint="Available on Pro"
            />
          </div>
          <div className="rounded-lg border border-border p-3">
            <UsageMeter
              label="Active price alerts"
              used={ctx.usage.activeAlerts}
              limit={e.alertsLimit}
              zeroLimitHint="Available on Collector"
            />
          </div>
          <div className="rounded-lg border border-border p-3">
            <UsageMeter label="Collection cards" used={ctx.usage.collectionItems} limit={e.collectionLimit} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {plan === 'free' && <UpgradeButton />}
          {plan !== 'pro' && (
            <Link href="/pricing" className="text-sm text-accent hover:underline">
              {plan === 'free' ? 'Compare plans' : 'Upgrade to Pro'}
            </Link>
          )}
          {sub?.hasStripeCustomer && hasStripe && <ManageBillingButton />}
          {!hasStripe && plan !== 'free' && (
            <p className="text-sm text-muted">Billing runs in mock mode in this demo build.</p>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          Scan and AI-check counters reset at the start of each month (UTC). Grade estimates are
          informational only — final grades are determined solely by the grading company.
        </p>
      </Card>

      <Card>
        <CardTitle>Your data &amp; privacy</CardTitle>
        <p className="mt-2 text-sm text-muted">
          Your card images are private by default and are never used for model training without your
          explicit, revocable consent. You can export your collection or delete your account at any
          time.
        </p>
        <div className="mt-3">
          <DataControls />
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
