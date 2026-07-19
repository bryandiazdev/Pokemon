import type Stripe from 'stripe';
import { withErrorHandling, jsonError, jsonOk } from '@/lib/api';
import {
  constructWebhookEvent,
  getStripe,
  syncSubscription,
  applyPlanEntitlements,
  resolveUserId,
} from '@/lib/services/billing';
import { getAdminSupabase } from '@/lib/supabase/admin';

/**
 * Stripe webhook — the SOURCE OF TRUTH for subscription state.
 *
 * - Signature-verified against the RAW request body (read as text before any
 *   JSON parsing).
 * - Idempotent: the event id is inserted into `stripe_webhook_events` first;
 *   a unique-violation means a duplicate delivery and is acked untouched.
 * - Every state change flows through syncSubscription(), which upserts the
 *   subscription row and writes catalog entitlements for the effective plan.
 * - Deletion reverts the user to Free: data is preserved, limits shrink.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  const payload = await req.text();
  if (!signature) return jsonError('unauthorized', 'Missing signature.');

  const event = constructWebhookEvent(payload, signature);
  if (!event) return jsonError('unauthorized', 'Invalid webhook signature.');

  const supabase = getAdminSupabase();
  if (!supabase) return jsonOk({ received: true, skipped: 'no database' });

  // Idempotency ledger: first delivery wins.
  const { error: insertError } = await supabase
    .from('stripe_webhook_events')
    .insert({ id: event.id, type: event.type, processed_at: new Date().toISOString() });
  if (insertError) {
    return jsonOk({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event, supabase);
  } catch (err) {
    // Log without dumping the full payload; Stripe will retry on 5xx, and the
    // ledger row means the retry is deduped — so delete it to allow reprocessing.
    // eslint-disable-next-line no-console
    console.error(`[stripe-webhook] ${event.type} (${event.id}) failed:`, err);
    await supabase.from('stripe_webhook_events').delete().eq('id', event.id);
    return jsonError('internal_error', 'Webhook processing failed.');
  }

  return jsonOk({ received: true });
});

type AdminClient = NonNullable<ReturnType<typeof getAdminSupabase>>;

async function handleEvent(event: Stripe.Event, supabase: AdminClient): Promise<void> {
  switch (event.type) {
    // A finished checkout: the session references the subscription — fetch the
    // full object and sync (metadata was attached via subscription_data).
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId ?? session.client_reference_id;
      // Persist the customer linkage even before the subscription events land.
      if (userId && session.customer) {
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: String(session.customer) })
          .eq('id', userId)
          .is('stripe_customer_id', null);
      }
      if (session.subscription) {
        const stripe = getStripe();
        if (stripe) {
          const sub = await stripe.subscriptions.retrieve(String(session.subscription));
          await syncSubscription(supabase, sub);
        }
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      await syncSubscription(supabase, event.data.object as Stripe.Subscription);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled', cancel_at_period_end: false })
        .eq('stripe_subscription_id', sub.id);
      const userId = await resolveUserId(supabase, sub);
      if (userId) {
        // Revert to Free. Collection data is preserved; over-limit collections
        // stay viewable — only ADDING is blocked by the entitlement gate.
        await applyPlanEntitlements(supabase, userId, 'free');
      }
      break;
    }

    // Payment lifecycle: statuses arrive via subscription.updated as well, but
    // these keep the row fresh when Stripe only emits the invoice events.
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : (invoice.subscription?.id ?? null);
      if (subId) {
        const stripe = getStripe();
        if (stripe) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(supabase, sub);
        }
      }
      break;
    }

    default:
      // Unhandled event types are acknowledged (and recorded in the ledger).
      break;
  }
}
