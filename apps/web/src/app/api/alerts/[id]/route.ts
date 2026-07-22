import { z } from 'zod';
import { jsonOk, jsonError, jsonPaywall, withErrorHandling, parse } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { getEntitlementContext, checkAlertCreate } from '@/lib/services/entitlements';
import { setAlertEnabled, deleteAlert } from '@/lib/services/alerts';

function alertIdFromUrl(reqUrl: string): string | null {
  const parts = new URL(reqUrl).pathname.split('/');
  const id = decodeURIComponent(parts[parts.length - 1] ?? '');
  return z.string().uuid().safeParse(id).success ? id : null;
}

const patchSchema = z.object({ enabled: z.boolean() });

export const PATCH = withErrorHandling(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user || user.isDemo) {
    return jsonError('unauthorized', 'Sign in to manage price alerts.');
  }
  const id = alertIdFromUrl(req.url);
  if (!id) return jsonError('validation_error', 'Invalid alert id.');

  const json = await req.json().catch(() => ({}));
  const parsed = parse(patchSchema, json);
  if (!parsed.ok) return parsed.response;

  // Re-enabling counts against the plan's active-alert limit, same as creating.
  if (parsed.value.enabled) {
    const gate = checkAlertCreate(await getEntitlementContext());
    if (!gate.allowed) return jsonPaywall(gate);
  }

  await setAlertEnabled(user.id, id, parsed.value.enabled);
  return jsonOk({ enabled: parsed.value.enabled });
});

export const DELETE = withErrorHandling(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user || user.isDemo) {
    return jsonError('unauthorized', 'Sign in to manage price alerts.');
  }
  const id = alertIdFromUrl(req.url);
  if (!id) return jsonError('validation_error', 'Invalid alert id.');

  await deleteAlert(user.id, id);
  return jsonOk({ deleted: true });
});
