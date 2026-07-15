import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ScanLine,
  Layers,
  TrendingUp,
  LineChart,
  BookOpen,
  Bell,
  Sparkles,
  FileSpreadsheet,
  Smartphone,
  ArrowRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Section, SectionHeader } from '@/components/marketing/section';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'A deeper look at scanning and identification, collection binders, raw and graded market values, historical charts, set completion, alerts, Grade Potential, import/export, and mobile.',
};

const FEATURES = [
  {
    icon: ScanLine,
    title: 'Scanning & identification',
    body: 'Camera capture with image-quality gates for blur, glare, exposure, and framing. Recognition returns ranked candidates so you confirm the exact printing — reverse holo, 1st edition vs. unlimited, or language variants included.',
    href: '/scanner',
    hrefLabel: 'How scanning works',
  },
  {
    icon: Layers,
    title: 'Collection & binders',
    body: 'Organize cards into binders, record quantities, condition notes, and what you paid. Everything lives in one place and stays private to your account by default.',
  },
  {
    icon: TrendingUp,
    title: 'Raw + graded market values',
    body: 'Compare raw prices against graded values side by side, so you can reason about whether a card is worth submitting — without any promise of a specific outcome.',
  },
  {
    icon: LineChart,
    title: 'Historical charts & portfolio',
    body: 'Follow how individual cards and your whole collection have moved over time with historical charts and a portfolio value view.',
  },
  {
    icon: BookOpen,
    title: 'Set completion',
    body: 'Track progress toward completing sets, spot the cards you are missing, and browse public set and card data without an account.',
  },
  {
    icon: Bell,
    title: 'Watchlists & alerts',
    body: 'Add cards to a watchlist and set price thresholds. Get notified when a card crosses a level you care about instead of checking manually.',
  },
  {
    icon: Sparkles,
    title: 'Grade Potential',
    body: 'Guided multi-capture computer-vision analysis produces an Estimated PSA Range and Confidence Level. These are estimates, not guarantees — a grading company may return a different result.',
    href: '/grade-potential',
    hrefLabel: 'How Grade Potential works',
  },
  {
    icon: FileSpreadsheet,
    title: 'Import / Export',
    body: 'Bring an existing collection in via CSV and export your data whenever you like. Your collection is yours — nothing is locked in.',
  },
  {
    icon: Smartphone,
    title: 'PWA & mobile',
    body: 'Installable, mobile-first, and built for scanning cards in hand. Large touch targets and a layout that works on the phone in your pocket.',
  },
];

export default function FeaturesPage() {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="Features"
          title="Built for collectors who want the real picture"
          lead="Every feature is designed to help you make better-informed decisions — with clear, honest framing about what the tool can and cannot tell you."
        />
      </Section>

      <Section className="pt-0">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="flex flex-col">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <feature.icon size={22} aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-content">{feature.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{feature.body}</p>
              {feature.href && (
                <Link
                  href={feature.href}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-strong"
                >
                  {feature.hrefLabel}
                  <ArrowRight size={16} aria-hidden />
                </Link>
              )}
            </Card>
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-surface p-6 sm:flex-row sm:items-center">
          <p className="text-base font-medium text-content">
            Ready to bring your collection into one place?
          </p>
          <Link
            href="/sign-up"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-strong"
          >
            Create account
          </Link>
        </div>
      </Section>
    </>
  );
}
