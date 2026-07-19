import type { Metadata } from 'next';
import Link from 'next/link';
import {
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
import { RadarMark } from '@/components/brand';
import { PLAN_PRICING } from '@psr/config';
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
    kicker: '01',
    title: 'Scan',
    body: 'Point your camera at a card. On-device OCR reads it, quality gates check the shot, then we identify the exact printing — with ranked candidates you confirm.',
  },
  {
    icon: ShieldCheck,
    kicker: '02',
    title: 'Grade-check',
    body: 'A guided, multi-capture computer-vision pass estimates a grade-potential range and confidence level. An estimate — never a guaranteed grade.',
  },
  {
    icon: TrendingUp,
    kicker: '03',
    title: 'Track',
    body: 'Add cards to your collection to follow raw and graded values, portfolio history, and price alerts over time.',
  },
];

const FEATURES = [
  { icon: Layers, title: 'Collection & binders', body: 'Organize cards into binders; track quantity, condition, and cost basis in one place.' },
  { icon: TrendingUp, title: 'Raw vs graded pricing', body: 'Compare raw values against graded prices to weigh the real trade-offs of submitting.' },
  { icon: LineChart, title: 'Portfolio over time', body: 'Daily snapshots and per-card history show how your collection actually moves.' },
  { icon: Bell, title: 'Price alerts', body: 'Set watchlist thresholds; get notified when a card crosses a price you care about.' },
  { icon: Sparkles, title: 'Grade Potential', body: 'Estimated PSA ranges and grade ceilings from a versioned, conservative rules engine.' },
  { icon: FileSpreadsheet, title: 'Import / export', body: 'Bring a collection in or export yours anytime. Your data stays yours.' },
];

/** Original abstract "graded holder" showcase — no Pokémon IP on the public page. */
function HeroSlab() {
  return (
    <div className="relative mx-auto w-full max-w-[300px] animate-fade-up">
      <div className="slab hairline-top holo group p-3">
        <div className="mb-2.5 flex items-center justify-between gap-2 rounded-md border border-border bg-bg-deep/70 px-3 py-2">
          <div>
            <div className="font-display text-sm font-semibold text-content">Submission Candidate</div>
            <div className="label-strip">Estimated PSA range</div>
          </div>
          <RadarMark size={20} sweep={false} className="opacity-70" />
        </div>
        <div className="relative aspect-[2.5/3.5] overflow-hidden rounded-md border border-border-strong bg-bg-deep">
          <div className="starfield absolute inset-0 opacity-70" />
          <div className="bg-prism absolute inset-0 opacity-[0.18]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <RadarMark size={104} className="opacity-40" />
          </div>
          <span className="holo-sheen" />
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            <span className="rounded border border-gold/40 bg-bg-deep/80 px-1.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-wider text-gold">
              Est. PSA 8–10
            </span>
            <span className="rounded border border-accent/40 bg-bg-deep/80 px-1.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-wider text-accent">
              82% conf.
            </span>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between px-1 font-mono text-[0.66rem] text-muted">
          <span>CENTERING 58/42</span>
          <span className="text-positive">SURFACE ✓</span>
        </div>
      </div>

      {/* Floating "track" chip. */}
      <div className="slab hairline-top absolute -bottom-6 -left-8 hidden w-40 p-3 sm:block">
        <div className="label-strip">Collection value</div>
        <div className="mt-1 flex items-end gap-1.5">
          {[10, 14, 9, 16, 13, 20, 18].map((h, i) => (
            <span
              key={i}
              className="w-1.5 rounded-sm bg-prism"
              style={{ height: `${h}px`, opacity: 0.35 + i * 0.09 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const price = fmtMinor(PLAN_PRICING.collector.month, PLAN_PRICING.collector.currency);

  return (
    <>
      {/* Hero */}
      <Section className="pt-10 sm:pt-14">
        <div className="grain relative overflow-hidden rounded-[28px] border border-border bg-bg-deep px-6 py-14 sm:px-12 sm:py-20">
          <div className="starfield absolute inset-0 opacity-60" />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(70% 60% at 78% 30%, rgb(var(--prism-3) / 0.12), transparent 60%), radial-gradient(60% 50% at 15% 80%, rgb(var(--prism-1) / 0.1), transparent 60%)',
            }}
          />
          <div className="relative grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="label-strip mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1.5 text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Independent Pokémon TCG intelligence
              </div>
              <h1 className="font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight text-content sm:text-6xl">
                Scan it.
                <br />
                <span className="text-prism">Grade-check it.</span>
                <br />
                Track it.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                Your entire Pokémon TCG collection — identified by camera, valued with live market
                data, and tracked like a portfolio. Estimate grade potential before you submit.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg bg-prism px-6 text-base font-semibold text-accent-ink shadow-pop transition-all hover:brightness-110"
                >
                  Create free account
                </Link>
                <Link
                  href="/sets"
                  className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-surface/40 px-6 text-base font-semibold text-content transition-colors hover:bg-surface-elevated"
                >
                  Explore cards
                  <ArrowRight size={17} aria-hidden />
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                {['Live prices · TCGdex', 'On-device OCR scan', 'Range-based grade estimates'].map(
                  (t) => (
                    <span
                      key={t}
                      className="label-strip rounded-md border border-border bg-surface/50 px-2.5 py-1.5 text-muted"
                    >
                      {t}
                    </span>
                  ),
                )}
              </div>
            </div>
            <div className="pb-6 sm:pb-0">
              <HeroSlab />
            </div>
          </div>
        </div>
      </Section>

      {/* How it works */}
      <Section className="pt-2">
        <SectionHeader
          eyebrow="How it works"
          title="From shoebox to tracked portfolio"
          lead="No hype, no guesswork about what the tool does. Here's the actual flow."
        />
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {STEPS.map((step) => (
            <Card key={step.title} className="flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-prism/15 text-accent ring-1 ring-inset ring-accent/20">
                  <step.icon size={22} aria-hidden />
                </span>
                <span className="font-mono text-2xl font-bold text-border-strong">{step.kicker}</span>
              </div>
              <h3 className="font-display text-xl font-semibold text-content">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Features */}
      <Section className="pt-2">
        <SectionHeader eyebrow="Features" title="Built for serious collections" />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="transition-colors hover:border-border-strong">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated text-accent ring-1 ring-inset ring-border">
                <feature.icon size={19} aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold text-content">
                {feature.title}
              </h3>
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
      <Section className="pt-2">
        <Card slab className="overflow-hidden">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <Badge tone="gold">COLLECTOR</Badge>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-content">
                {price}
                <span className="font-sans text-base font-normal text-muted">/month</span>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Unlimited collection, historical price charts, portfolio analytics, price alerts,
                and CSV export. Start free; go Pro for AI-assisted grade analysis.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
              <Link
                href="/pricing"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-strong px-5 text-sm font-semibold text-content transition-colors hover:bg-surface-elevated"
              >
                Compare plans
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-prism px-5 text-sm font-semibold text-accent-ink transition-all hover:brightness-110"
              >
                Create account
              </Link>
            </div>
          </div>
        </Card>
      </Section>

      {/* Honesty note */}
      <Section className="pt-2">
        <div className="card-surface hairline-top p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-accent" aria-hidden />
            <h2 className="font-display text-lg font-semibold text-content">Honest by design</h2>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
            Grade Potential results are computer-vision estimates expressed as ranges with a
            confidence level — not guaranteed grades. A grading company may return a different
            result, and cameras can miss microscopic or hidden defects. Pricing comes from licensed
            or official provider APIs. We are not affiliated with PSA, Beckett, CGC, The Pokémon
            Company, or any data provider.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link
              href="/methodology"
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-strong"
            >
              Read our methodology <ArrowRight size={16} aria-hidden />
            </Link>
            <Link
              href="/attribution"
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-strong"
            >
              Data attribution <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
