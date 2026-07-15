import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Radar,
  ScanLine,
  ShieldCheck,
  TrendingUp,
  Layers,
  LineChart,
  Bell,
  Sparkles,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PRICING } from '@psr/config';
import { Section, SectionHeader } from '@/components/marketing/section';
import { fmtMinor } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Scan it. Grade-check it. Track it.',
  description:
    'Your entire Pokémon TCG collection, identified, valued, and tracked in one place. Estimate grade potential before you submit — with honest, range-based analysis.',
};

const STEPS = [
  {
    icon: ScanLine,
    title: 'Scan',
    body: 'Point your camera at a card. We check image quality, then identify the exact printing with ranked candidates for you to confirm.',
  },
  {
    icon: ShieldCheck,
    title: 'Grade-check',
    body: 'Guided multi-capture computer-vision analysis estimates a grade potential range and confidence level — never a guaranteed grade.',
  },
  {
    icon: TrendingUp,
    title: 'Track',
    body: 'Add cards to your collection to follow raw and graded values, portfolio history, and price alerts over time.',
  },
];

const FEATURES = [
  {
    icon: Layers,
    title: 'Collection tracking',
    body: 'Organize cards into binders, track quantities, conditions, and purchase costs in one place.',
  },
  {
    icon: TrendingUp,
    title: 'Raw & graded pricing',
    body: 'Compare raw values against graded values so you can weigh the trade-offs of submitting.',
  },
  {
    icon: LineChart,
    title: 'Portfolio value over time',
    body: 'See how your collection has moved with historical charts and per-card history.',
  },
  {
    icon: Bell,
    title: 'Price alerts',
    body: 'Set watchlist thresholds and get notified when a card crosses a price you care about.',
  },
  {
    icon: Sparkles,
    title: 'Grade Potential analysis',
    body: 'Estimated PSA ranges and grade ceilings from a versioned, conservative rules engine.',
  },
  {
    icon: FileSpreadsheet,
    title: 'CSV import/export',
    body: 'Bring an existing collection in, or export yours whenever you want. Your data stays yours.',
  },
];

export default function HomePage() {
  const price = fmtMinor(
    PRICING.collectorPro.monthly.amountMinor,
    PRICING.collectorPro.monthly.currency,
  );

  return (
    <>
      {/* Hero */}
      <Section className="pt-16 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm text-muted">
            <Radar size={15} className="text-accent" aria-hidden />
            An independent tool for Pokémon TCG collectors
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-content sm:text-6xl">
            Scan it. Grade-check it. Track it.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
            Your entire Pokémon TCG collection, identified, valued, and tracked in one place.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-6 py-3 text-base font-semibold text-bg transition-colors hover:bg-accent-strong sm:w-auto"
            >
              Create account
            </Link>
            <Link
              href="/sets"
              className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg border border-border bg-transparent px-6 py-3 text-base font-semibold text-content transition-colors hover:bg-surface-elevated sm:w-auto"
            >
              Explore cards
              <ArrowRight size={17} aria-hidden />
            </Link>
          </div>
        </div>
      </Section>

      {/* How it works */}
      <Section className="pt-0">
        <SectionHeader
          eyebrow="How it works"
          title="Three steps from shoebox to tracked collection"
          lead="No hype and no guesswork about what the tool can do. Here's the actual flow."
        />
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Card key={step.title} className="flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <step.icon size={22} aria-hidden />
                </span>
                <span className="text-sm font-semibold text-muted">Step {i + 1}</span>
              </div>
              <h3 className="text-lg font-semibold text-content">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Features grid */}
      <Section className="pt-0">
        <SectionHeader
          eyebrow="Features"
          title="Everything you need to manage a serious collection"
        />
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated text-accent">
                <feature.icon size={20} aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold text-content">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
            </Card>
          ))}
        </div>
        <div className="mt-8">
          <Link
            href="/features"
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-strong"
          >
            See the full feature breakdown
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </Section>

      {/* Pricing teaser */}
      <Section className="pt-0">
        <Card className="overflow-hidden">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <Badge tone="gold">Collector Pro</Badge>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content">
                {price}
                <span className="text-base font-normal text-muted">/month</span>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Unlimited collection, full price history, raw + graded comparisons, batch scanning,
                and advanced analytics. Start free and upgrade when you need more.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
              <Link
                href="/pricing"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-content transition-colors hover:bg-surface-elevated"
              >
                Compare plans
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-strong"
              >
                Create account
              </Link>
            </div>
          </div>
        </Card>
      </Section>

      {/* Honesty note */}
      <Section className="pt-0">
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-accent" aria-hidden />
            <h2 className="text-base font-semibold text-content">Honest by design</h2>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
            Grade Potential results are computer-vision estimates expressed as ranges with a
            confidence level — not guaranteed grades. A grading company may return a different
            result, and cameras can miss microscopic or hidden defects. Pricing comes from licensed
            or official provider APIs. In development, clearly labeled demo data is used and does not
            reflect live market values.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link
              href="/methodology"
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-strong"
            >
              Read our methodology
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link
              href="/attribution"
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-strong"
            >
              Data attribution
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
