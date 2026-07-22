import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { listAlerts } from '@/lib/services/alerts';
import { getEntitlementContext } from '@/lib/services/entitlements';
import { getCard } from '@/lib/services/catalog';
import { AlertsManager, type PrefillCard } from './alerts-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Price alerts' };

interface Props {
  searchParams: Promise<{ card?: string }>;
}

export default async function AlertsPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  const live = Boolean(user && !user.isDemo);

  if (!live) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <h1 className="font-display text-2xl font-semibold">Price alerts</h1>
        <Card>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Bell size={22} className="text-accent" aria-hidden />
            <p className="max-w-md text-sm text-muted">
              Get notified when a card crosses your target — &ldquo;tell me when this drops below
              $50&rdquo;, &ldquo;tell me if it jumps 20% in a week&rdquo;. Price alerts are
              available on Collector and Pro plans.
            </p>
            <div className="flex gap-2">
              <Link
                href="/sign-in"
                className="inline-flex min-h-[40px] items-center rounded-lg bg-accent px-4 text-sm font-medium text-bg transition-colors hover:bg-accent-strong"
              >
                Sign in
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-[40px] items-center rounded-lg border border-border px-4 text-sm transition-colors hover:border-border-strong hover:bg-surface-elevated"
              >
                See plans
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const [alerts, ctx, params] = await Promise.all([
    listAlerts(user!.id),
    getEntitlementContext(),
    searchParams,
  ]);

  // ?card=<externalId> prefills the create form (the card-page bell sends it).
  let prefill: PrefillCard | null = null;
  if (params.card) {
    try {
      const card = await getCard(params.card);
      prefill = { externalId: card.externalId, name: card.name, number: card.number };
    } catch {
      // Unknown card id — open the page without a prefill.
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Price alerts</h1>
        <p className="text-muted">Get notified when a card crosses your target.</p>
      </div>
      <AlertsManager
        initialAlerts={alerts}
        used={ctx.usage.activeAlerts}
        limit={ctx.entitlements.alertsLimit}
        plan={ctx.entitlements.plan}
        prefill={prefill}
      />
      <p className="text-xs text-muted">
        Alerts are evaluated against the daily price sync, with per-alert cooldowns so one move
        can&rsquo;t spam you. Triggered alerts appear in your notifications. Not investment
        advice.
      </p>
    </div>
  );
}
