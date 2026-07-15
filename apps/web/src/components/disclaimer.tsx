import { GRADE_DISCLAIMER } from '@psr/grading-rules';
import { AlertTriangle } from 'lucide-react';

/** The mandatory grade-report disclaimer. Rendered on every grade report/EV view. */
export function GradeDisclaimer({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={`flex gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-content ${className ?? ''}`}
    >
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden />
      <p className="leading-relaxed text-muted">{GRADE_DISCLAIMER}</p>
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="rounded-lg border border-demo/30 bg-demo/10 px-4 py-2 text-sm text-demo">
      Demo mode — all prices and grades shown are illustrative sample data, not live market values.
    </div>
  );
}
