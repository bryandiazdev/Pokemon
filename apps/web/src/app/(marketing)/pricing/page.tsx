import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PRICING } from '@psr/config';
import { fmtMinor } from '@/lib/format';
import { Section, SectionHeader } from '@/components/marketing/section';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Start free, or upgrade to Collector Pro for $4.99/month: 100 quick scans, 10 grade scans, unlimited collection, full history, alerts, CSV import/export, and advanced analytics.',
};

const FREE_FEATURES = [
  'Public card & set search',
  'Small collection (up to 50 cards)',
  'Limited quick scans each month',
  'Grade Potential demo',
  'Watchlist with a few alerts',
];

const PRO_FEATURES = [
  '100 quick scans / month',
  '10 grade scans / month',
  'Unlimited collection (with abuse protection)',
  'Full price history',
  'Raw + graded comparisons',
  'Up to 100 price alerts',
  'CSV import / export',
  'Saved grade reports',
  'Batch scanning',
  'Advanced analytics',
];

const FAQ = [
  {
    q: 'Can I start for free?',
    a: 'Yes. The Free plan lets you search public data, track a small collection, and try Grade Potential in demo mode. Upgrade only when you need more.',
  },
  {
    q: 'How is billing handled?',
    a: 'Subscriptions are processed by Stripe. Your plan and entitlements are enforced server-side, so what you can access is always determined authoritatively on our servers — not in the browser.',
  },
  {
    q: 'Is there an annual plan?',
    a: 'Annual pricing is configured in Stripe and may be offered at checkout. Monthly is shown here as the reference price.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. You can cancel from your account at any time and keep access through the end of your current billing period.',
  },
];

export default function PricingPage() {
  const monthly = fmtMinor(
    PRICING.collectorPro.monthly.amountMinor,
    PRICING.collectorPro.monthly.currency,
  );

  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="Pricing"
          title="Simple pricing for serious collectors"
          lead="Start free. Upgrade to Collector Pro when your collection outgrows the basics."
        />
      </Section>

      <Section className="pt-0">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Free */}
          <Card className="flex flex-col">
            <Badge tone="neutral">Free</Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-content">
              $0<span className="text-base font-normal text-muted">/month</span>
            </h2>
            <p className="mt-2 text-sm text-muted">
              Everything you need to get started and try the tool.
            </p>
            <ul className="mt-6 flex-1 space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-content">
                  <Check size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/sign-up"
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-content transition-colors hover:bg-surface-elevated"
            >
              Create free account
            </Link>
          </Card>

          {/* Collector Pro */}
          <Card className="flex flex-col border-accent/40 ring-1 ring-accent/20">
            <div className="flex items-center gap-2">
              <Badge tone="gold">Collector Pro</Badge>
              <Badge tone="info">Most popular</Badge>
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-content">
              {monthly}
              <span className="text-base font-normal text-muted">/month</span>
            </h2>
            <p className="mt-2 text-sm text-muted">
              {PRICING.collectorPro.annualNote}
            </p>
            <ul className="mt-6 flex-1 space-y-3">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-content">
                  <Check size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/sign-up"
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-strong"
            >
              Get Collector Pro
            </Link>
          </Card>
        </div>

        <p className="mt-6 text-sm text-muted">
          Plan limits are enforced server-side and can be adjusted per account. Prices are shown for
          reference; Stripe is the source of truth at checkout.
        </p>
      </Section>

      <Section className="pt-0">
        <SectionHeader as="h2" title="Pricing FAQ" />
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {FAQ.map((item) => (
            <Card key={item.q}>
              <h3 className="text-base font-semibold text-content">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.a}</p>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
