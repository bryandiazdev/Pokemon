import type { Metadata } from 'next';
import Link from 'next/link';
import { Target, Scale, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Section, SectionHeader, Prose } from '@/components/marketing/section';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Our mission is to help Pokémon TCG collectors make better-informed decisions with honest tools — no hype, no guarantees, and no fake data.',
};

const VALUES = [
  {
    icon: Target,
    title: 'Useful over flashy',
    body: 'We build features that help you make decisions, not dashboards that overpromise. If the tool cannot know something, it says so.',
  },
  {
    icon: Scale,
    title: 'Honest by default',
    body: 'Estimates are ranges with confidence levels, pricing sources are disclosed, and demo data is clearly labeled. No fake stats or testimonials.',
  },
  {
    icon: Lock,
    title: 'Your data is yours',
    body: 'Collections are private by default. You can export everything and delete your account whenever you want.',
  },
];

export default function AboutPage() {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="About"
          title="Better-informed collecting"
          lead="Pokémon Stock Radar exists to help collectors identify, value, and track their cards — and to think clearly about grading — without hype."
        />
      </Section>

      <Section className="pt-0">
        <Prose>
          <p>
            Collecting should be fun, and good decisions should be based on good information. Too
            many tools in this space lean on inflated claims, guaranteed-grade promises, or numbers
            that fall apart under scrutiny. We took the opposite approach: build something genuinely
            useful, be upfront about its limits, and let collectors decide for themselves.
          </p>
          <p>
            That means grade estimates are ranges, not guarantees. It means pricing comes from
            licensed or official providers with attribution, never scraped. And it means we are an
            independent tool — not affiliated with, endorsed by, or approved by Pokémon or any
            grading company.
          </p>
        </Prose>
      </Section>

      <Section className="pt-0">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {VALUES.map((value) => (
            <Card key={value.title}>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <value.icon size={22} aria-hidden />
              </span>
              <h2 className="mt-4 text-base font-semibold text-content">{value.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{value.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-surface p-6 sm:flex-row sm:items-center">
          <p className="text-base font-medium text-content">Questions or feedback?</p>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-content transition-colors hover:bg-surface-elevated"
          >
            Contact us
          </Link>
        </div>
      </Section>
    </>
  );
}
