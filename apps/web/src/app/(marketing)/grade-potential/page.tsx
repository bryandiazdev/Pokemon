import type { Metadata } from 'next';
import Link from 'next/link';
import { Camera, Eye, EyeOff, Calculator, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { GradeDisclaimer } from '@/components/disclaimer';
import { Section, SectionHeader, Prose } from '@/components/marketing/section';

export const metadata: Metadata = {
  title: 'Grade Potential',
  description:
    'A guided multi-capture workflow estimates grade potential as a range with a confidence level. Learn what the camera can and cannot detect, and how to think about the expected value of grading.',
};

const CAPTURES = ['Front', 'Back', 'Angled', 'Corners', 'Edges'];

const CAN_SEE = [
  'Centering and border geometry',
  'Visible corner and edge wear',
  'Surface scratches large enough to catch light',
  'Whitening and obvious print lines',
];

const CANNOT_SEE = [
  'Microscopic or hidden defects',
  'Issues obscured by glare, sleeves, or soft focus',
  'How a professional grader will judge borderline cases',
  'Anything outside the captured frames',
];

export default function GradePotentialPage() {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="Grade Potential"
          title="A guided grade-check, framed honestly"
          lead="A multi-capture workflow gives the analysis more to work with — and gives you a clear, range-based estimate instead of false certainty."
        />
      </Section>

      <Section className="pt-0">
        <Card>
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-accent" aria-hidden />
            <h2 className="text-lg font-semibold text-content">The multi-capture workflow</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            You are guided through several captures so centering, corners, edges, and surface can
            each be assessed. More angles mean a better-supported estimate.
          </p>
          <ol className="mt-5 flex flex-wrap gap-2">
            {CAPTURES.map((c, i) => (
              <li
                key={c}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-content"
              >
                <span className="text-xs font-semibold text-muted">{i + 1}</span>
                {c}
              </li>
            ))}
          </ol>
        </Card>
      </Section>

      <Section className="pt-0">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Card>
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-positive/15 text-positive">
              <Eye size={22} aria-hidden />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-content">What the camera can detect</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {CAN_SEE.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-positive">
                    +
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-warning/15 text-warning">
              <EyeOff size={22} aria-hidden />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-content">
              What it cannot detect
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {CANNOT_SEE.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-warning">
                    −
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>

      <Section className="pt-0">
        <Prose>
          <h2 className="flex items-center gap-2">
            <Calculator size={20} className="text-accent" aria-hidden />
            Thinking about the value of grading
          </h2>
          <p>
            Comparing a card&apos;s estimated grade potential range against raw and graded market
            values can help you reason about whether submitting is worth the cost and wait. This is
            a way to think through a decision, not a recommendation and{' '}
            <strong>not financial advice</strong>. Outcomes vary, grading fees and timelines change,
            and a grading company may return a different result than any estimate.
          </p>
          <p>
            We will never tell you to alter, clean, press, trim, or otherwise modify a card. Those
            practices can damage cards and are considered tampering. The tool only helps you
            understand and track what you already have.
          </p>
        </Prose>
      </Section>

      <Section className="pt-0">
        <SectionHeader as="h2" title="The disclaimer on every estimate" />
        <div className="mt-6 max-w-3xl">
          <GradeDisclaimer />
        </div>
        <div className="mt-6">
          <Link
            href="/methodology"
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-strong"
          >
            Read the full methodology
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </Section>
    </>
  );
}
