import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { Section, SectionHeader } from '@/components/marketing/section';
import { PricingPlans } from '@/components/billing/pricing-plans';
import { getCurrentUser } from '@/lib/auth';
import { getSubscriptionSummary } from '@/lib/services/billing';
import { hasSupabase } from '@/lib/env';
import type { PlanTier } from '@psr/config';

export const metadata: Metadata = {
  title: 'Pricing | Pokémon Stock Radar',
  description:
    'Track your Pokémon card collection, monitor live market prices, and unlock AI-assisted grade potential analysis.',
  alternates: { canonical: '/pricing' },
};

const FAQ = [
  {
    q: 'Can I start for free?',
    a: 'Yes. The Free plan includes card identification by camera, current raw market prices, and a collection of up to 100 cards — enough to genuinely use the product before paying anything.',
  },
  {
    q: 'What does Collector add?',
    a: 'Collector is built for active collectors: unlimited collection size, historical price charts, portfolio gain/loss analytics, price alerts, market movers, and CSV export — up to 500 scans a month.',
  },
  {
    q: 'What does Pro add?',
    a: 'Pro is grading intelligence: AI-assisted condition analysis (centering, corners, edges, surface), estimated grade potential with a confidence breakdown, "should I grade this?" recommendations, and grading ROI analysis. Grade estimates are informational only — final grades are determined solely by the grading company.',
  },
  {
    q: 'How does annual billing work?',
    a: 'Annual plans bill once a year at a discount versus twelve monthly payments. The exact savings are shown on the toggle above — calculated from the real prices, not a marketing number.',
  },
  {
    q: 'How is billing handled?',
    a: 'Subscriptions are processed by Stripe. Your plan and limits are enforced on our servers — never just hidden in the browser. You can manage payment methods, invoices, plan changes, and cancellation from the billing portal in your account.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your account at any time and keep access through the end of the period you paid for. Your collection data is never deleted — if you end up over the Free limits, everything stays viewable; only adding more is paused.',
  },
];

export default async function PricingPage() {
  // Server-rendered subscription state: no client flash, no layout shift.
  let currentPlan: PlanTier | null = null;
  let signedIn = false;
  try {
    const user = await getCurrentUser();
    if (user && !user.isDemo && hasSupabase) {
      signedIn = true;
      const summary = await getSubscriptionSummary(user.id);
      currentPlan = summary.plan;
    }
  } catch {
    // Render signed-out pricing rather than failing the page.
  }

  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="Pricing"
          title="Choose how deep you want to go."
          lead="Start free. Upgrade for advanced market intelligence, portfolio tracking, and AI-assisted grade analysis."
        />
      </Section>

      <Section className="pt-0">
        <PricingPlans currentPlan={currentPlan} signedIn={signedIn} />
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
