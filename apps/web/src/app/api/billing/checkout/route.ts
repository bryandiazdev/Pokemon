import { z } from 'zod';
import { jsonOk, withErrorHandling, parse } from '@/lib/api';
import { createCheckoutSession } from '@/lib/services/billing';
import { getCurrentUser } from '@/lib/auth';
import { env } from '@/lib/env';

const bodySchema = z.object({ interval: z.enum(['month', 'year']).default('month') });

export const POST = withErrorHandling(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) {
    return jsonOk({ url: '/sign-in' }, { requiresAuth: true });
  }
  const json = await req.json().catch(() => ({}));
  const parsed = parse(bodySchema, json);
  if (!parsed.ok) return parsed.response;

  const base = env.NEXT_PUBLIC_APP_URL;
  const session = await createCheckoutSession({
    userId: user.id,
    email: user.email,
    interval: parsed.value.interval,
    successUrl: `${base}/app/account?upgraded=1`,
    cancelUrl: `${base}/pricing`,
  });
  return jsonOk(session);
});
