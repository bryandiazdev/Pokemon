import { GradeClient } from './grade-client';
import { EvCalculator } from './ev-calculator';

export const metadata = { title: 'Grade Potential' };

export default function GradePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Grade Potential</h1>
        <p className="text-muted">
          A guided, computer-vision condition analysis to help you decide whether to submit — an
          estimate, never a guarantee.
        </p>
      </div>
      <GradeClient />
      <EvCalculator />
    </div>
  );
}
