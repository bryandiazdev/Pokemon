import Link from 'next/link';
import { Layers } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { getEntitlementContext } from '@/lib/services/entitlements';
import { BatchScanClient } from './batch-scan-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Batch scan' };

export default async function BatchScanPage() {
  const ctx = await getEntitlementContext();
  const enabled = ctx.entitlements.batchScanningEnabled;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Batch scan</h1>
        <p className="text-muted">
          Photograph several cards at once — a binder page or a spread — and confirm them all in
          one pass.
        </p>
      </div>

      {enabled ? (
        <BatchScanClient />
      ) : (
        <Card>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Layers size={22} className="text-accent" aria-hidden />
            <p className="max-w-md text-sm text-muted">
              Batch scanning identifies every card in a single photo — up to 12 at a time — and
              lets you confirm them into your collection in one pass. It&rsquo;s available on the
              Pro plan.
            </p>
            <div className="flex gap-2">
              <Link
                href="/pricing"
                className="inline-flex min-h-[40px] items-center rounded-lg bg-accent px-4 text-sm font-medium text-bg transition-colors hover:bg-accent-strong"
              >
                See Pro plans
              </Link>
              <Link
                href="/app/scan"
                className="inline-flex min-h-[40px] items-center rounded-lg border border-border px-4 text-sm transition-colors hover:border-border-strong hover:bg-surface-elevated"
              >
                Single scan
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
