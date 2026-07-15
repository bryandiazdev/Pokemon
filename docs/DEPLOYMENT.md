# Deployment

## Components
- **apps/web** → Vercel (Next.js App Router).
- **Supabase** → Postgres + Auth + Storage (migrations in `packages/database`).
- **apps/vision** → containerized FastAPI; deploy to Cloud Run / Railway / Render / Modal / ECS
  (CPU is sufficient for the deterministic pipeline; reserve GPU only for trained models).
- **Trigger.dev** → background jobs. **Upstash Redis** → cache/locks/rate-limit.
- **Stripe** → billing. **Resend** → email. **Sentry** → monitoring. **PostHog** → analytics.

## Local development (no paid keys required)
```bash
corepack enable && corepack prepare pnpm@9.15.9 --activate
pnpm install
cp .env.example .env.local          # defaults to DATA_MODE=demo, all providers = demo
# Option A — fully offline demo (no Supabase): app runs with fixtures
pnpm dev                            # http://localhost:3000

# Option B — with local Supabase (auth + real DB):
supabase start                      # requires Supabase CLI + Docker
pnpm db:migrate && pnpm db:seed
pnpm dev

# Vision service (optional, for grade scans):
cd apps/vision && python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]" && uvicorn app.main:app --reload --port 8000
```

## Environment variables
See `.env.example`. `@psr/config` validates them at boot and fails fast with a readable error if a
required var is missing for the selected `DATA_MODE`. In `DATA_MODE=demo`, provider and paid keys
are optional.

## Supabase setup
1. Create project; copy URL + anon + service-role keys into env.
2. `pnpm db:migrate` applies ordered SQL in `packages/database/migrations`.
3. Configure Auth providers (email, magic link, Google OAuth), redirect URLs, and Storage buckets
   (`card-images`, `scan-images`) as **private**.
4. Verify RLS is enabled on all user tables (`pnpm --filter @psr/database test:rls`).

## Stripe setup
1. Create product **Collector Pro** with a $4.99/mo price and an annual price.
2. Put price IDs in `STRIPE_COLLECTOR_PRO_MONTHLY_PRICE_ID` / `..._ANNUAL_PRICE_ID`.
3. Add a webhook to `/api/webhooks/stripe`; put the signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Entitlements are defined in DB (`entitlements` + plan defaults in `@psr/config`) — change
   limits without a deploy.

## Trigger.dev / Redis / Resend / Sentry / PostHog
Add the corresponding keys from `.env.example`; each integration degrades gracefully (no-ops with
a warning) when its key is absent, so the app still boots.

## CI/CD
GitHub Actions (`.github/workflows/ci.yml`): install → typecheck → lint → unit tests → vision
tests → build → migration validation → dependency audit. Production deploy is blocked when
critical jobs fail.

## Migration procedure & rollback
- Forward-only numbered SQL migrations; each has a documented manual rollback note in its header.
- Deploy order: migrate DB → deploy web → deploy vision. Roll back web first if a release breaks;
  data migrations are written to be backward-compatible for one release.

## Production-readiness checklist
See `IMPLEMENTATION_PLAN.md` Phase 10 and the checklist appended to `PROGRESS.md`.
