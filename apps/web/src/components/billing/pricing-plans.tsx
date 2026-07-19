'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PLAN_PRICING, annualSavingsPct, type PlanTier } from '@psr/config';

/**
 * Interactive pricing cards: monthly/annual toggle, three tiers, checkout.
 * The server passes the viewer's current plan so CTAs are accurate without a
 * client fetch (no flash of wrong state). All authorization is server-side —
 * these buttons only *start* flows.
 */

type Interval = 'month' | 'year';

const fmt = (minor: number) => `$${(minor / 100).toFixed(2).replace(/\.00$/, '')}`;

const FREE_FEATURES = [
  'Up to 25 card scans / month',
  'Up to 100 cards in your collection',
  'Card identification by camera',
  'Current raw market prices',
  'Basic collection value',
  'Watchlist',
];

const COLLECTOR_FEATURES = [
  'Up to 500 card scans / month',
  'Unlimited collection size',
  'Historical price charts',
  'Portfolio gain & loss analytics',
  'Graded pricing where available',
  'Up to 25 active price alerts',
  'Market movers',
  'Collection CSV export',
];

const PRO_FEATURES = [
  'Everything in Collector',
  'Up to 2,000 card scans / month',
  '30 AI grade checks / month',
  'Centering, corner, edge & surface analysis',
  'Estimated grade potential + confidence',
  '“Should I grade this?” recommendation',
  'Grading ROI (expected value) analysis',
  'Up to 250 active price alerts',
];

export function PricingPlans({
  currentPlan,
  signedIn,
}: {
  currentPlan: PlanTier | null;
  signedIn: boolean;
}) {
  const [interval, setInterval] = useState<Interval>('month');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const savings = Math.max(annualSavingsPct('collector'), annualSavingsPct('pro'));

  async function startCheckout(plan: 'collector' | 'pro') {
    if (!signedIn) {
      window.location.href = '/sign-up';
      return;
    }
    setBusy(plan);
    setError('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval }),
      });
      const body = await res.json();
      if (body.success && body.data?.url) {
        window.location.href = body.data.url;
        return;
      }
      setError(body.error?.message ?? 'Could not start checkout. Try again.');
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  const price = (plan: 'collector' | 'pro') =>
    interval === 'month'
      ? { amount: fmt(PLAN_PRICING[plan].month), per: '/month' }
      : { amount: fmt(PLAN_PRICING[plan].year), per: '/year' };

  return (
    <div className="space-y-6">
      {/* Billing toggle */}
      <div className="flex justify-center">
        <div
          role="group"
          aria-label="Billing period"
          className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface p-1"
        >
          <button
            type="button"
            onClick={() => setInterval('month')}
            aria-pressed={interval === 'month'}
            className={`min-h-10 rounded-lg px-4 text-sm font-medium transition-colors ${
              interval === 'month' ? 'bg-surface-elevated text-content' : 'text-muted hover:text-content'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval('year')}
            aria-pressed={interval === 'year'}
            className={`min-h-10 rounded-lg px-4 text-sm font-medium transition-colors ${
              interval === 'year' ? 'bg-surface-elevated text-content' : 'text-muted hover:text-content'
            }`}
          >
            Annual <span className="ml-1 text-accent">— save up to {savings}%</span>
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-center text-sm text-warning">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Free */}
        <Card className="flex flex-col">
          <div className="flex items-center gap-2">
            <Badge tone="neutral">Free</Badge>
            {currentPlan === 'free' && <Badge tone="info">Current plan</Badge>}
          </div>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-content">
            $0<span className="text-base font-normal text-muted">/month</span>
          </h2>
          <p className="mt-2 text-sm text-muted">Start cataloging your collection.</p>
          <ul className="mt-6 flex-1 space-y-3">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-content">
                <Check size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          {signedIn ? (
            <span className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-5 py-3 text-sm text-muted">
              {currentPlan === 'free' ? 'Your current plan' : 'Included with your plan'}
            </span>
          ) : (
            <Link
              href="/sign-up"
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-content transition-colors hover:bg-surface-elevated"
            >
              Create free account
            </Link>
          )}
        </Card>

        {/* Collector */}
        <Card className="flex flex-col border-accent/40 ring-1 ring-accent/20">
          <div className="flex items-center gap-2">
            <Badge tone="gold">Collector</Badge>
            <Badge tone="info">Most popular</Badge>
            {currentPlan === 'collector' && <Badge tone="positive">Current plan</Badge>}
          </div>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-content">
            {price('collector').amount}
            <span className="text-base font-normal text-muted">{price('collector').per}</span>
          </h2>
          <p className="mt-2 text-sm text-muted">
            Track your collection like a portfolio.
            {interval === 'year' && (
              <span className="ml-1 text-accent">Save {annualSavingsPct('collector')}% vs monthly.</span>
            )}
          </p>
          <ul className="mt-6 flex-1 space-y-3">
            {COLLECTOR_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-content">
                <Check size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy !== null || currentPlan === 'collector'}
            onClick={() => startCheckout('collector')}
            className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-strong disabled:opacity-60"
          >
            {busy === 'collector' && <Loader2 size={15} className="animate-spin" aria-hidden />}
            {currentPlan === 'collector'
              ? 'Your current plan'
              : currentPlan === 'pro'
                ? 'Switch via billing portal'
                : 'Get Collector'}
          </button>
        </Card>

        {/* Pro */}
        <Card className="flex flex-col border-demo/40 ring-1 ring-demo/20">
          <div className="flex items-center gap-2">
            <Badge tone="demo">Pro</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-demo">
              <Sparkles size={12} aria-hidden /> Grading intelligence
            </span>
            {currentPlan === 'pro' && <Badge tone="positive">Current plan</Badge>}
          </div>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-content">
            {price('pro').amount}
            <span className="text-base font-normal text-muted">{price('pro').per}</span>
          </h2>
          <p className="mt-2 text-sm text-muted">
            Know what may be worth grading before you submit.
            {interval === 'year' && (
              <span className="ml-1 text-accent">Save {annualSavingsPct('pro')}% vs monthly.</span>
            )}
          </p>
          <ul className="mt-6 flex-1 space-y-3">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-content">
                <Check size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy !== null || currentPlan === 'pro'}
            onClick={() => startCheckout('pro')}
            className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-prism px-5 py-3 text-sm font-semibold text-accent-ink transition-all hover:brightness-110 disabled:opacity-60"
          >
            {busy === 'pro' && <Loader2 size={15} className="animate-spin" aria-hidden />}
            {currentPlan === 'pro' ? 'Your current plan' : 'Get Pro'}
          </button>
        </Card>
      </div>

      <p className="text-center text-xs text-muted">
        Grade estimates are informational only and never guaranteed — final grades are determined
        solely by the grading company. Plan limits are enforced server-side.
      </p>
    </div>
  );
}
