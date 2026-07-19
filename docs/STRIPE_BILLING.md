# Stripe Billing Setup

Subscription monetization for Pokémon Stock Radar: **Free**, **Collector**
($7.99/mo · $79/yr), and **Pro** ($19.99/mo · $199/yr).

The centralized plan catalog lives in `packages/config/src/plans.ts` — plans,
entitlements, pricing, price-ID mapping, and the paid-access status policy all
resolve through it. Do not compare Stripe price IDs anywhere else.

## 1. Stripe products and prices to create

In the [Stripe dashboard](https://dashboard.stripe.com) (start in **test
mode**), create **two products** (the Free plan needs none):

| Product   | Price                | Interval | Env var for the resulting price ID    |
| --------- | -------------------- | -------- | ------------------------------------- |
| Collector | **$7.99 USD**        | monthly  | `STRIPE_COLLECTOR_MONTHLY_PRICE_ID`   |
| Collector | **$79 USD**          | yearly   | `STRIPE_COLLECTOR_ANNUAL_PRICE_ID`    |
| Pro       | **$19.99 USD**       | monthly  | `STRIPE_PRO_MONTHLY_PRICE_ID`         |
| Pro       | **$199 USD**         | yearly   | `STRIPE_PRO_ANNUAL_PRICE_ID`          |

Copy each `price_...` ID into the matching env var. The amounts must match
`PLAN_PRICING` in the catalog (the pricing page derives its display and the
annual-savings percentages from there).

## 2. Environment variables

```bash
STRIPE_SECRET_KEY=sk_test_...        # server-only; never NEXT_PUBLIC
STRIPE_WEBHOOK_SECRET=whsec_...      # from the webhook endpoint (step 3)
STRIPE_COLLECTOR_MONTHLY_PRICE_ID=price_...
STRIPE_COLLECTOR_ANNUAL_PRICE_ID=price_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID=   # optional (bpc_...)
NEXT_PUBLIC_APP_URL=https://pokemonstockradar.com
DEV_BILLING_PLAN_OVERRIDE=           # dev-only plan override; leave empty
```

All Stripe secrets are consumed exclusively by server modules
(`apps/web/src/lib/services/billing.ts`, the webhook route); nothing Stripe-
secret is ever exposed with a `NEXT_PUBLIC_` prefix. When `STRIPE_SECRET_KEY`
is unset the app runs in **mock billing mode**: checkout redirects straight to
the success URL with `?mock=1` and grants no access.

## 3. Webhook endpoint

Path: **`/api/webhooks/stripe`**

Create a webhook endpoint in Stripe (Developers → Webhooks) pointing at
`https://<your-domain>/api/webhooks/stripe` and subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.

Handler guarantees:

- The **raw body** is signature-verified before any parsing.
- **Idempotent**: each event ID is inserted into `stripe_webhook_events`
  first; duplicate deliveries are acknowledged without reprocessing. A failed
  handler deletes its ledger row and returns 5xx so Stripe's retry can
  reprocess.
- The webhook is the **source of truth**: it upserts `subscriptions` and
  syncs the per-user `entitlements` row from the plan catalog. The
  `?upgraded=1` success redirect only shows an optimistic banner — it grants
  nothing.

## 4. Local webhook testing (Stripe CLI)

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copy the whsec_... it prints into STRIPE_WEBHOOK_SECRET, restart pnpm dev

# then exercise flows:
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

End-to-end local test: sign up at `/sign-up` (requires local Supabase, see
README), open `/pricing`, subscribe with card `4242 4242 4242 4242`, and watch
the webhook sync your `subscriptions` + `entitlements` rows.

## 5. Database migration

Billing tables shipped in `0004_billing.sql`; the three-tier upgrade is
`0013_billing_v2.sql` (new `plan_tier` values, `profiles.stripe_customer_id`,
atomic `consume_usage` / `release_usage` functions). Apply like every other
migration:

```bash
for f in packages/database/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

Existing users default to **Free** (rows on the legacy `collector_pro` tier
are migrated to `collector`). Over-limit Free collections remain fully
viewable — only *adding* is blocked until upgrade or trim.

## 6. How entitlements and usage limits work

- `entitlements` (one row per user) holds the *effective* limits; the webhook
  writes catalog defaults on every subscription change. Per-user overrides
  are possible by editing the row (useful for support and future credit
  packs).
- Monthly metrics (`quick_scan`, `grade_scan`) live in `usage_periods`, keyed
  by UTC calendar month. `consume_usage` **reserves atomically** (a single
  conditional `UPDATE`, so concurrent requests can't race past a limit);
  failed operations are refunded via `release_usage`. Alerts and collection
  size are live row counts.
- Paid access policy (`statusGrantsPaidAccess`): `active` and `trialing` are
  paid; **`past_due` keeps access as a documented grace period** (Stripe is
  still retrying the card; the UI shows a billing warning); `unpaid`,
  `canceled`, `incomplete`, `incomplete_expired`, `paused` are not paid.
- Plan changes for existing subscribers go through the **Billing Portal**
  (chosen for reliability: Stripe handles proration, interval switches, and
  duplicate-subscription prevention). Checkout refuses to create a second
  subscription for a customer that already has one and redirects to the
  portal instead.

## 7. Customer Portal configuration

Dashboard → Settings → Billing → Customer portal: enable payment-method
updates, invoice history, cancellation (at period end), and plan changes
between the four prices above. Optionally pin a configuration via
`STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID`.

## 8. Changing prices later

Create the **new** price in Stripe, update the env var, deploy. Existing
subscribers stay on their old price until migrated (Stripe keeps old price IDs
functional); `planForPriceId` only needs to know *current* prices for new
checkouts, but keep old price IDs in the env if you want plan mapping for
grandfathered subscribers (add them to the env values, comma-separation is
NOT supported — prefer migrating subscribers in Stripe instead).

## 9. Testing

```bash
pnpm --filter @psr/config --filter @psr/web test   # catalog + gate tests
pnpm -r typecheck && pnpm --filter @psr/web build
```

Automated tests mock everything; no live Stripe calls.

## 10. Production checklist

1. Live-mode products/prices created; live price IDs in Vercel env.
2. Live `STRIPE_SECRET_KEY` + webhook endpoint on the production domain with
   its own `STRIPE_WEBHOOK_SECRET`.
3. `NEXT_PUBLIC_APP_URL=https://pokemonstockradar.com`.
4. Migration `0013` applied to the production database.
5. Customer Portal configured (step 7).
6. `DEV_BILLING_PLAN_OVERRIDE` **unset**.
7. Test a real end-to-end subscribe + cancel with a live card, then refund.

## 11. Troubleshooting

- **Checkout works but plan never activates** → webhook secret mismatch or
  endpoint not receiving events; check Stripe's webhook delivery log and the
  `stripe_webhook_events` table.
- **"You already have a subscription"** → expected duplicate-prevention; use
  Manage billing.
- **User stuck on Free after paying** → confirm the subscription has
  `metadata.userId` (set by checkout) or the profile has the right
  `stripe_customer_id`; re-deliver the event from the Stripe dashboard.
- **Usage not resetting** → periods are UTC calendar months; verify with
  `select * from usage_periods where user_id = ...`.
