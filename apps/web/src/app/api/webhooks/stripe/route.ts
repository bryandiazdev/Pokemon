import { withErrorHandling, jsonError, jsonOk } from '@/lib/api';
import { constructWebhookEvent } from '@/lib/services/billing';
import { getAdminSupabase } from '@/lib/supabase/admin';

/**
 * Stripe webhook handler. Signature-verified and IDEMPOTENT: each event id is
 * recorded in `stripe_webhook_events`; a duplicate delivery is acknowledged
 * without reprocessing. Subscription state is written with the service-role
 * client after verification (never trusted from the client).
 */
export const POST = withErrorHandling(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  const payload = await req.text();
  if (!signature) return jsonError('unauthorized', 'Missing signature.');

  const event = constructWebhookEvent(payload, signature);
  if (!event) return jsonError('unauthorized', 'Invalid webhook signature.');

  const supabase = getAdminSupabase();
  if (supabase) {
    // Idempotency: insert the event id; if it already exists, skip processing.
    const { error: insertError } = await supabase
      .from('stripe_webhook_events')
      .insert({ id: event.id, type: event.type, payload: event.data.object as never });
    if (insertError) {
      // Unique-violation → already processed.
      return jsonOk({ received: true, duplicate: true });
    }
    await handleEvent(event, supabase);
  }

  return jsonOk({ received: true });
});

async function handleEvent(
  event: import('stripe').Stripe.Event,
  supabase: NonNullable<ReturnType<typeof getAdminSupabase>>,
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as import('stripe').Stripe.Subscription;
      const userId = (sub.metadata?.userId as string) ?? null;
      if (!userId) break;
      await supabase.from('subscriptions').upsert(
        {
          user_id: userId,
          stripe_customer_id: String(sub.customer),
          stripe_subscription_id: sub.id,
          stripe_price_id: sub.items.data[0]?.price.id ?? null,
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
        },
        { onConflict: 'stripe_subscription_id' },
      );
      // Entitlements would be synced from plan defaults here.
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as import('stripe').Stripe.Subscription;
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', sub.id);
      break;
    }
    case 'invoice.payment_failed': {
      // Mark past_due; a grace-period + dunning email would be triggered here.
      break;
    }
    default:
      break;
  }
}
