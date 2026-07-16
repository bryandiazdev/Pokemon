import { getProviderStatus } from '@/lib/providers';
import { Sparkles, Info } from 'lucide-react';

/**
 * Honest, provider-aware data notice. Shows a "live data" note when real sources
 * are active and a "demo data" note only when they are not — never a blanket
 * "everything is fake" banner over live data.
 */
export function DataModeBanner() {
  const status = getProviderStatus();

  if (status.rawPricingLive || status.catalogLive) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-positive/30 bg-positive/10 px-4 py-2 text-sm text-positive">
        <Sparkles size={15} aria-hidden />
        <span>
          Live data via {status.sourceName}. Raw prices are real market snapshots; graded/population
          figures are still sample data (labeled below).
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-demo/30 bg-demo/10 px-4 py-2 text-sm text-demo">
      <Info size={15} aria-hidden />
      <span>
        Demo mode — prices and grades shown are illustrative sample data. Set{' '}
        <code className="rounded bg-demo/20 px-1">PROVIDER_PRESET=tcgdex</code> for free live cards
        and prices (no API key needed).
      </span>
    </div>
  );
}
