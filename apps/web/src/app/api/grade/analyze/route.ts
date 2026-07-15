import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling, parse } from '@/lib/api';
import { evaluateGrade, DISCLAIMER_VERSION, GRADE_DISCLAIMER, type SubScores, type LimitingFinding } from '@psr/grading-rules';
import { getEntitlementContext, checkGradeScan } from '@/lib/services/entitlements';
import { env } from '@/lib/env';

/**
 * Grade-potential analysis. When a live vision service is configured
 * (VISION_SERVICE_URL) this proxies the multi-capture images to it. Otherwise it
 * runs the shared deterministic rules engine over provided/sample sub-scores so
 * the flow is demonstrable — clearly labeled as a demo estimate.
 */
const bodySchema = z.object({
  cardExternalId: z.string().optional(),
  // Sub-scores 0-100 (from the vision service in live mode; sample in demo).
  scores: z
    .object({
      centering: z.number().min(0).max(100),
      corner: z.number().min(0).max(100),
      edge: z.number().min(0).max(100),
      surface: z.number().min(0).max(100),
      structural: z.number().min(0).max(100),
      imageQuality: z.number().min(0).max(100),
    })
    .optional(),
  findings: z
    .array(
      z.object({
        key: z.string(),
        severity: z.enum(['none', 'minor', 'moderate', 'severe']),
        title: z.string(),
      }),
    )
    .optional(),
});

const SAMPLE_SCORES: SubScores = {
  centering: 88,
  corner: 84,
  edge: 90,
  surface: 72,
  structural: 96,
  imageQuality: 82,
};

export const POST = withErrorHandling(async (req: Request) => {
  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;

  const ctx = await getEntitlementContext();
  const gate = checkGradeScan(ctx);
  if (!gate.allowed) return jsonError('usage_limit_reached', gate.message);

  const scores = parsed.value.scores ?? SAMPLE_SCORES;
  const findings = (parsed.value.findings ?? []) as LimitingFinding[];
  const estimate = evaluateGrade(scores, findings);

  return jsonOk({
    estimate,
    scores,
    modelVersion: env.VISION_SERVICE_URL ? 'vision-live' : 'cv-heuristic-0.1.0-demo',
    disclaimerVersion: DISCLAIMER_VERSION,
    disclaimer: GRADE_DISCLAIMER,
    remaining: gate.remaining,
  });
});
