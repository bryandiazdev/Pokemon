import { jsonOk, jsonError, withErrorHandling } from '@/lib/api';
import { createPortalSession, getCustomerIdForUser } from '@/lib/services/billing';
import { getCurrentUser } from '@/lib/auth';
import { env } from '@/lib/env';

/**
 * Open the Stripe Billing Portal for the signed-in user. The customer id is
 * ALWAYS resolved server-side from the user's own profile — never accepted
 * from the browser.
 */
export const POST = withErrorHandling(async () => {
  const user = await getCurrentUser();
  if (!user || user.isDemo) {
    return jsonError('unauthorized', 'Sign in to manage billing.');
  }
  const customerId = await getCustomerIdForUser(user.id);
  if (!customerId) {
    return jsonError('not_found', 'No billing profile yet — subscribe first from the pricing page.');
  }
  const url = await createPortalSession(customerId, `${env.NEXT_PUBLIC_APP_URL}/app/account`);
  if (!url) {
    return jsonError('provider_unavailable', 'Billing portal is not available right now.');
  }
  return jsonOk({ url });
});
