import type { Metadata } from 'next';
import { ChevronDown } from 'lucide-react';
import { Section, SectionHeader } from '@/components/marketing/section';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Answers to common questions: affiliation, grade guarantees, where pricing comes from, CSV import, cost, and how your data is handled.',
};

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Is this affiliated with PSA, Pokémon, or any grading company?',
    a: 'No. Pokémon Stock Radar is an independent tool and is not affiliated with, endorsed, sponsored, or approved by Nintendo, The Pokémon Company, Game Freak, Creatures Inc., PSA, Beckett, CGC, SGC, TAG, ACE, or any pricing or data provider. Those names are used only to identify products or describe the grading scales an estimate refers to.',
  },
  {
    q: 'Do you guarantee grades?',
    a: 'No. Grade Potential results are computer-vision estimates expressed as a range with a confidence level — never a guaranteed grade. Professional grading is subjective and performed in person, and a grading company may return a different result. Cameras can also miss microscopic or hidden defects.',
  },
  {
    q: 'Where does pricing data come from?',
    a: 'Pricing comes from licensed or official provider APIs, used under each provider’s terms with attribution. In development we use clearly labeled demo data that does not reflect live market values. We do not scrape prices.',
  },
  {
    q: 'Can I import my existing collection?',
    a: 'Yes. You can import your collection from a CSV file, and you can export your data at any time. Your collection is yours and is never locked in.',
  },
  {
    q: 'What does it cost?',
    a: 'There is a free plan to get started. Collector Pro is $4.99 per month and adds more scans, unlimited collection size, full history, alerts, import/export, and advanced analytics. Annual pricing may be offered at checkout via Stripe.',
  },
  {
    q: 'Is my data private?',
    a: 'Your collection and uploaded card images are private by default. You can export your data and delete your account whenever you like. We do not sell your data, and images are not used for training without your explicit, revocable consent.',
  },
];

export default function FaqPage() {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="FAQ"
          title="Frequently asked questions"
          lead="Straight answers to the questions collectors ask most."
        />
      </Section>

      <Section className="pt-0">
        <div className="max-w-3xl divide-y divide-border rounded-xl border border-border bg-surface">
          {FAQ.map((item) => (
            <details key={item.q} className="group px-5">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-semibold text-content">
                {item.q}
                <ChevronDown
                  size={18}
                  aria-hidden
                  className="shrink-0 text-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}
