/** Centering math shared between the vision service outputs and the web UI. */

export interface BorderWidths {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface CenteringResult {
  horizontal: string; // e.g. "60/40" (larger/smaller)
  vertical: string;
  horizontalOffset: number; // 0 = perfect, 0.5 = worst (all on one side)
  verticalOffset: number;
  score: number; // 0-100
}

function ratioString(a: number, b: number): string {
  const total = a + b;
  if (total <= 0) return '50/50';
  const larger = Math.round((Math.max(a, b) / total) * 100);
  return `${larger}/${100 - larger}`;
}

/** Offset from perfect centering on one axis: 0 (perfect) .. 0.5 (fully off). */
function axisOffset(a: number, b: number): number {
  const total = a + b;
  if (total <= 0) return 0;
  return Math.abs(a - b) / (2 * total);
}

export function computeCentering(b: BorderWidths): CenteringResult {
  const horizontalOffset = axisOffset(b.left, b.right);
  const verticalOffset = axisOffset(b.top, b.bottom);
  // Worst axis dominates; map offset 0->100, 0.25->~50, 0.5->0.
  const worst = Math.max(horizontalOffset, verticalOffset);
  const score = Math.max(0, Math.round(100 * (1 - worst / 0.5)));
  return {
    horizontal: ratioString(b.left, b.right),
    vertical: ratioString(b.top, b.bottom),
    horizontalOffset,
    verticalOffset,
    score,
  };
}

/** Parse a tolerance string like "60/40" into a max off-center offset (0..0.5). */
export function toleranceToOffset(tolerance: string): number {
  const [largerStr] = tolerance.split('/');
  const larger = Number(largerStr) / 100;
  return Math.abs(larger - 0.5);
}
