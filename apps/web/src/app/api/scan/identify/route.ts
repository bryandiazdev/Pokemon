import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling, parse } from '@/lib/api';
import { getRegistry } from '@/lib/providers';
import { getEntitlementContext, checkQuickScan } from '@/lib/services/entitlements';

const bodySchema = z.object({
  // A short-lived reference (data URL length-limited) — never a public bucket path.
  imageRef: z.string().min(1).max(2_000_000),
  // Client-computed quality gate results; the server re-decides acceptance.
  quality: z
    .object({
      blur: z.number().min(0).max(1),
      glare: z.number().min(0).max(1),
      coverage: z.number().min(0).max(1),
      brightness: z.number().min(0).max(1),
    })
    .optional(),
});

const CONFIDENCE_THRESHOLD = 0.75;

export const POST = withErrorHandling(async (req: Request) => {
  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;

  // Server-side usage gate BEFORE any (potentially paid) provider call.
  const ctx = await getEntitlementContext();
  const gate = checkQuickScan(ctx);
  if (!gate.allowed) {
    return jsonError('usage_limit_reached', gate.message);
  }

  // Server re-validates image quality; poor images are rejected with guidance.
  const q = parsed.value.quality;
  if (q) {
    const issues: string[] = [];
    if (q.blur > 0.6) issues.push('The image looks blurry — hold steady and refocus.');
    if (q.glare > 0.5) issues.push('Glare is hiding part of the card — reduce direct light.');
    if (q.coverage < 0.4) issues.push('Move closer so the card fills the frame.');
    if (q.brightness < 0.2) issues.push('Too dark — use brighter indirect light.');
    if (q.brightness > 0.95) issues.push('Overexposed — reduce lighting.');
    if (issues.length > 0) {
      return jsonError('image_rejected', issues.join(' '));
    }
  }

  const result = await getRegistry().call('recognition', 'identifyCard', (a) =>
    a.identifyCard({ imageRef: parsed.value.imageRef }),
  );

  const top = result.candidates[0];
  const requiresConfirmation =
    result.requiresConfirmation || !top || top.confidence < CONFIDENCE_THRESHOLD;

  return jsonOk({
    candidates: result.candidates,
    requiresConfirmation,
    remaining: gate.remaining,
  });
});
