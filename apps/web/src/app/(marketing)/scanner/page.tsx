import type { Metadata } from 'next';
import Link from 'next/link';
import { Camera, Focus, ListOrdered, Search, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Section, SectionHeader, Prose } from '@/components/marketing/section';

export const metadata: Metadata = {
  title: 'How scanning works',
  description:
    'Camera framing, image-quality gates for blur, glare, exposure, and coverage, ranked recognition candidates, confirmation for look-alike printings, and a manual-search fallback.',
};

const STEPS = [
  {
    icon: Camera,
    title: 'Frame the card',
    body: 'An on-screen guide helps you line the card up flat and fully in view. Good framing is the single biggest factor in a clean scan.',
  },
  {
    icon: Focus,
    title: 'Image-quality gates',
    body: 'Before we try to identify anything, the capture is checked for blur, glare, exposure, and coverage. If quality is too low, you are asked to retake rather than getting a shaky result.',
  },
  {
    icon: ListOrdered,
    title: 'Ranked candidates',
    body: 'Recognition returns a ranked list of likely matches. You confirm the correct one — the tool does not silently assume.',
  },
  {
    icon: Search,
    title: 'Manual search fallback',
    body: 'If nothing looks right, search the catalog by name, set, or number and pick the exact card yourself.',
  },
];

export default function ScannerPage() {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="Scanning"
          title="How scanning works"
          lead="Scanning is fast, but it always keeps you in control of the final identification."
        />
      </Section>

      <Section className="pt-0">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {STEPS.map((step, i) => (
            <Card key={step.title}>
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <step.icon size={22} aria-hidden />
                </span>
                <span className="text-sm font-semibold text-muted">Step {i + 1}</span>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-content">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <Prose>
          <h2>Why confirmation matters for look-alikes</h2>
          <p>
            Many Pokémon cards share nearly identical artwork across printings that carry very
            different values. We surface these differences and ask you to confirm rather than
            guessing, including cases like:
          </p>
          <ul>
            <li>Reverse holo vs. standard printings</li>
            <li>1st Edition vs. Unlimited</li>
            <li>English vs. Japanese and other language variants</li>
            <li>Promo and set-specific stamps or symbols</li>
          </ul>
          <p>
            Requiring a quick confirmation keeps your collection data accurate — which matters when
            values and grade estimates depend on the exact printing.
          </p>
        </Prose>
        <div className="mt-6">
          <Link
            href="/grade-potential"
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-strong"
          >
            Next: how Grade Potential works
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </Section>
    </>
  );
}
