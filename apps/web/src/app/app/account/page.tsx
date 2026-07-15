import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCurrentUser } from '@/lib/auth';
import { getEntitlementContext, remainingLabel } from '@/lib/services/entitlements';
import { UpgradeButton, DataControls } from './account-actions';
import { hasStripe } from '@/lib/env';

export const metadata = { title: 'Account' };

export default async function AccountPage() {
  const [user, ctx] = await Promise.all([getCurrentUser(), getEntitlementContext()]);
  const e = ctx.entitlements;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold">Account</h1>

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
        <div className="flex items-center justify-between">
          <CardTitle>Subscription</CardTitle>
          <Badge tone={e.plan === 'collector_pro' ? 'gold' : 'neutral'}>
            {e.plan === 'collector_pro' ? 'Collector Pro' : 'Free'}
          </Badge>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Meter label="Quick scans" limit={e.quickScanMonthlyLimit} used={ctx.usage.quickScansUsed} />
          <Meter label="Grade scans" limit={e.gradeScanMonthlyLimit} used={ctx.usage.gradeScansUsed} />
          <Meter label="Active alerts" limit={e.alertsLimit} used={ctx.usage.activeAlerts} />
          <Meter label="Collection items" limit={e.collectionLimit} used={ctx.usage.collectionItems} />
        </div>
        <div className="mt-4">
          {e.plan === 'free' ? (
            <UpgradeButton />
          ) : (
            <p className="text-sm text-muted">
              {hasStripe
                ? 'Manage billing through the Stripe customer portal.'
                : 'Billing runs in mock mode in this demo build.'}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Your data & privacy</CardTitle>
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

function Meter({ label, limit, used }: { label: string; limit: number; used: number }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min(100, (used / Math.max(1, limit)) * 100);
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">{remainingLabel(limit, used)}</span>
      </div>
      {!unlimited && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} aria-hidden />
        </div>
      )}
    </div>
  );
}
