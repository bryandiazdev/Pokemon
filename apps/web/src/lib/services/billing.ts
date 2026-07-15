import 'server-only';
import Stripe from 'stripe';
import { env, hasStripe } from '../env';

/**
 * Stripe billing service. When Stripe isn't configured (demo), checkout returns a
 * mock URL and the app behaves as if the demo user is on Collector Pro. Real
 * subscription state is ALWAYS derived server-side from Stripe/webhooks.
 */

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!hasStripe) return null;
  if (!stripeSingleton) {
    // Pin the SDK's default API version (avoids drift with the installed types).
    stripeSingleton = new Stripe(env.STRIPE_SECRET_KEY!);
  }
  return stripeSingleton;
}

export interface CheckoutParams {
  userId: string;
  email: string;
  interval: 'month' | 'year';
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(params: CheckoutParams): Promise<{ url: string; mock: boolean }> {
  const stripe = getStripe();
  const priceId =
    params.interval === 'year'
      ? env.STRIPE_COLLECTOR_PRO_ANNUAL_PRICE_ID
      : env.STRIPE_COLLECTOR_PRO_MONTHLY_PRICE_ID;

  if (!stripe || !priceId) {
    // Mock mode — no real charge; return the success URL so the flow is exercisable.
    return { url: `${params.successUrl}?mock=1`, mock: true };
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: params.email,
    client_reference_id: params.userId,
    metadata: { userId: params.userId },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: true,
  });
  return { url: session.url ?? params.cancelUrl, mock: false };
}

export async function createPortalSession(customerId: string, returnUrl: string): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

/** Verify a webhook signature and return the event, or null if invalid. */
export function constructWebhookEvent(payload: string, signature: string): Stripe.Event | null {
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) return null;
  try {
    return stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return null;
  }
}
