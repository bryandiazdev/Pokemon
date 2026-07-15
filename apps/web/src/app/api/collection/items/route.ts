import { z } from 'zod';
import { jsonOk, withErrorHandling, parse } from '@/lib/api';
import { RAW_CONDITIONS, GRADING_COMPANIES, OWNERSHIP_TYPES } from '@psr/types';
import { getEntitlementContext, checkCollectionAdd } from '@/lib/services/entitlements';
import { isDemo } from '@/lib/env';

const bodySchema = z
  .object({
    cardExternalId: z.string().min(1),
    quantity: z.number().int().min(1).max(10_000),
    ownershipType: z.enum(OWNERSHIP_TYPES),
    rawCondition: z.enum(RAW_CONDITIONS).optional(),
    gradingCompany: z.enum(GRADING_COMPANIES).optional(),
    grade: z.string().max(8).optional(),
    purchasePriceMajor: z.number().min(0).optional(),
    purchaseCurrency: z.string().length(3).default('USD'),
    purchaseDate: z.string().optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => v.ownershipType !== 'graded' || (v.gradingCompany && v.grade), {
    message: 'Graded items require a grading company and grade.',
    path: ['grade'],
  });

export const POST = withErrorHandling(async (req: Request) => {
  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;

  // Server-authoritative entitlement check (never trust the client).
  const ctx = await getEntitlementContext();
  const gate = checkCollectionAdd(ctx);
  if (!gate.allowed) {
    return jsonOk({ persisted: false, gate }, { blocked: true });
  }

  // In demo mode we do not persist. In live mode this inserts into
  // collection_items via the RLS-scoped Supabase client after re-checking auth.
  return jsonOk(
    {
      persisted: !isDemo,
      item: { ...parsed.value, id: crypto.randomUUID() },
    },
    { demo: isDemo },
  );
});
