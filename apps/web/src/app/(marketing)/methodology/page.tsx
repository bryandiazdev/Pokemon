import type { Metadata } from 'next';
import Link from 'next/link';
import { Crosshair, Layers, ListChecks, Gauge, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GradeDisclaimer } from '@/components/disclaimer';
import { APPROVED_GRADE_TERMS } from '@psr/grading-rules';
import { Section, SectionHeader, Prose } from '@/components/marketing/section';

export const metadata: Metadata = {
  title: 'Methodology',
  description:
    'How Grade Potential works: a hybrid of deterministic geometry analysis, classical computer-vision heuristics, and a versioned conservative rules engine — producing ranges with a confidence level, never a guaranteed grade.',
};

const PIPELINE = [
  {
    icon: Crosshair,
    title: 'Deterministic geometry (OpenCV)',
    body: 'Centering and geometry are measured deterministically from the captured image — border ratios, framing, and alignment — using classical computer-vision techniques, not guesswork.',
  },
  {
    icon: Layers,
    title: 'Classical CV heuristics',
    body: 'Corners, edges, surface, and whitening are assessed with established image-processing heuristics. These flag likely condition issues the camera can see.',
  },
  {
    icon: ListChecks,
    title: 'Versioned conservative rules engine',
    body: 'A versioned rules engine combines those signals into an estimate. It is deliberately conservative and every result records the rules version used.',
  },
  {
    icon: Gauge,
    title: 'Ranges with confidence',
    body: 'The output is a range with a Confidence Level — not a single number and not a promise. Lower-quality captures widen the range and lower confidence.',
  },
];

export default function MethodologyPage() {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="Methodology"
          title="How Grade Potential is estimated"
          lead="We think you deserve to know exactly how the numbers are produced. Here is the honest version — including the limits."
        />
      </Section>

      <Section className="pt-0">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {PIPELINE.map((step) => (
            <Card key={step.title}>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <step.icon size={22} aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-content">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <Prose>
          <h2>A general language model is never the sole engine</h2>
          <p>
            The analysis is grounded in deterministic geometry and classical computer vision plus a
            versioned rules engine. A general-purpose language model is never used as the sole
            grading engine, and it never overrides the measured signals. This keeps results
            explainable and reproducible for a given rules version.
          </p>

          <h2>What the camera can and cannot see</h2>
          <p>
            A camera captures what light and focus allow. It can miss microscopic surface scratches,
            hidden print defects, and issues obscured by glare, sleeves, or soft focus. Professional
            grading is subjective and performed in person, so a grading company may reach a
            different conclusion. That is why every estimate is a range, and every report carries a
            disclaimer.
          </p>

          <h2>The language we use</h2>
          <p>
            To keep things honest, we only ever describe results with these terms:
          </p>
        </Prose>
        <div className="mt-4 flex max-w-3xl flex-wrap gap-2">
          {APPROVED_GRADE_TERMS.map((term) => (
            <Badge key={term} tone="neutral">
              {term}
            </Badge>
          ))}
        </div>
        <Prose className="mt-6">
          <p>
            We never make grade guarantees or claim an official or approved grade. Grading-company
            names are used only to describe the scale a range refers to.
          </p>
        </Prose>
      </Section>

      <Section className="pt-0">
        <SectionHeader as="h2" title="The disclaimer on every report" />
        <div className="mt-6 max-w-3xl">
          <GradeDisclaimer />
        </div>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/grade-potential"
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-strong"
          >
            See the Grade Potential workflow
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
      </Section>
    </>
  );
}
