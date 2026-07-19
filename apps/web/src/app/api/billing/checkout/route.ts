import { z } from 'zod';
import { jsonOk, jsonError, withErrorHandling, parse } from '@/lib/api';
import { startCheckout } from '@/lib/services/billing';
import { getCurrentUser } from '@/lib/auth';
import { env } from '@/lib/env';

/**
 * Start a subscription checkout. The client sends only {plan, interval} —
 * price IDs are resolved server-side from the catalog allowlist. Users with
 * an existing subscription are routed to the Billing Portal instead of a
 * second Checkout (no duplicate subscriptions).
 */
const bodySchema = z.object({
  plan: z.enum(['collector', 'pro']),
  interval: z.enum(['month', 'year']).default('month'),
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user || user.isDemo) {
    return jsonOk({ url: '/sign-up' }, { requiresAuth: true });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;

  const base = env.NEXT_PUBLIC_APP_URL;
  const outcome = await startCheckout({
    user: { id: user.id, email: user.email },
    key: { plan: parsed.value.plan, interval: parsed.value.interval },
    successUrl: `${base}/app/account?upgraded=1`,
    cancelUrl: `${base}/pricing?canceled=1`,
  });

  if (outcome.kind === 'error') {
    return jsonError('conflict', outcome.message);
  }
  return jsonOk({ url: outcome.url, kind: outcome.kind });
});
