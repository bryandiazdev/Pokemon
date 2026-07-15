import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling, parse } from '@/lib/api';
import { RAW_CONDITIONS, GRADING_COMPANIES } from '@psr/types';
import { getEntitlementContext, checkAlertCreate } from '@/lib/services/entitlements';
import { isDemo } from '@/lib/env';

const bodySchema = z.object({
  cardExternalId: z.string().min(1),
  direction: z.enum(['above', 'below', 'pct_increase', 'pct_decrease']),
  threshold: z.number().min(0).optional(),
  percentageChange: z.number().min(0).max(100).optional(),
  condition: z.enum(RAW_CONDITIONS).optional(),
  gradingCompany: z.enum(GRADING_COMPANIES).optional(),
  grade: z.string().max(8).optional(),
  cadence: z.enum(['immediate', 'daily', 'weekly']).default('immediate'),
});

export const POST = withErrorHandling(async (req: Request) => {
  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;

  const ctx = await getEntitlementContext();
  const gate = checkAlertCreate(ctx);
  if (!gate.allowed) return jsonError('entitlement_exceeded', gate.message);

  return jsonOk(
    { persisted: !isDemo, alert: { id: crypto.randomUUID(), enabled: true, ...parsed.value } },
    { demo: isDemo },
  );
});
