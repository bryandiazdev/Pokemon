import { z } from 'zod';
import { jsonOk, jsonError, jsonPaywall, withErrorHandling, parse } from '@/lib/api';
import { RAW_CONDITIONS, GRADING_COMPANIES } from '@psr/types';
import { getCurrentUser } from '@/lib/auth';
import { getEntitlementContext, checkAlertCreate } from '@/lib/services/entitlements';
import { createAlert, listAlerts } from '@/lib/services/alerts';

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user || user.isDemo) {
    return jsonError('unauthorized', 'Sign in to manage price alerts.');
  }
  return jsonOk({ alerts: await listAlerts(user.id) });
});

const bodySchema = z
  .object({
    cardExternalId: z.string().min(1).max(64),
    direction: z.enum(['above', 'below', 'pct_increase', 'pct_decrease']),
    /** Target price in minor units (cents) for above/below. */
    thresholdMinor: z.number().int().min(1).max(100_000_000).optional(),
    percentageChange: z.number().min(1).max(1000).optional(),
    condition: z.enum(RAW_CONDITIONS).optional(),
    gradingCompany: z.enum(GRADING_COMPANIES).optional(),
    grade: z.string().max(8).optional(),
    cadence: z.enum(['immediate', 'daily', 'weekly']).default('immediate'),
  })
  .refine(
    (v) =>
      v.direction === 'above' || v.direction === 'below'
        ? v.thresholdMinor != null
        : v.percentageChange != null,
    { message: 'Above/below alerts need a target price; percentage alerts need a percent.' },
  );

export const POST = withErrorHandling(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user || user.isDemo) {
    return jsonError('unauthorized', 'Sign in to create price alerts.');
  }

  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;

  const ctx = await getEntitlementContext();
  const gate = checkAlertCreate(ctx);
  if (!gate.allowed) return jsonPaywall(gate);

  const { thresholdMinor, ...rest } = parsed.value;
  const created = await createAlert(user.id, { ...rest, thresholdMinor });
  return jsonOk({ alert: { id: created.id, enabled: true, ...parsed.value } });
});
