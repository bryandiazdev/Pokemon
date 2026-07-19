import { z } from 'zod';
import { jsonOk, jsonError, jsonPaywall, withErrorHandling, parse } from '@/lib/api';
import { RAW_CONDITIONS, GRADING_COMPANIES, OWNERSHIP_TYPES } from '@psr/types';
import { getEntitlementContext, checkCollectionAdd } from '@/lib/services/entitlements';
import { getCurrentUser } from '@/lib/auth';
import { addCollectionItem, listCollectionItems } from '@/lib/services/collection';

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
    collectionId: z.string().uuid().optional(),
  })
  .refine((v) => v.ownershipType !== 'graded' || (v.gradingCompany && v.grade), {
    message: 'Graded items require a grading company and grade.',
    path: ['grade'],
  });

export const POST = withErrorHandling(async (req: Request) => {
  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;
  const v = parsed.value;

  // Must be a real, signed-in user (not the demo workspace) to persist.
  const user = await getCurrentUser();
  if (!user || user.isDemo) {
    return jsonError('unauthorized', 'Sign in to save cards to your collection.');
  }

  // Server-authoritative entitlement check (never trust the client).
  // Over-limit collections stay fully viewable — only ADDING is blocked.
  const ctx = await getEntitlementContext();
  const gate = checkCollectionAdd(ctx);
  if (!gate.allowed) {
    return jsonPaywall(gate);
  }

  const { id } = await addCollectionItem(user.id, {
    cardExternalId: v.cardExternalId,
    quantity: v.quantity,
    ownershipType: v.ownershipType,
    rawCondition: v.rawCondition,
    gradingCompany: v.gradingCompany,
    grade: v.grade,
    // Convert major → integer minor units for storage.
    purchasePriceMinor:
      v.purchasePriceMajor != null ? Math.round(v.purchasePriceMajor * 100) : undefined,
    purchaseCurrency: v.purchaseCurrency,
    purchaseDate: v.purchaseDate ?? null,
    notes: v.notes ?? null,
    collectionId: v.collectionId,
  });

  return jsonOk({ persisted: true, id });
});

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user || user.isDemo) {
    return jsonError('unauthorized', 'Sign in to view your collection.');
  }
  const items = await listCollectionItems(user.id);
  return jsonOk({ items });
});
