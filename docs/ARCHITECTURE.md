# Architecture

## System overview

```
                         ┌────────────────────────────────────────────┐
                         │                 Clients                     │
                         │   PWA (mobile-first)  ·  Desktop browser     │
                         └───────────────┬────────────────────────────┘
                                         │ HTTPS
                         ┌───────────────▼────────────────────────────┐
                         │        apps/web  (Next.js App Router)       │
                         │  RSC pages · Route handlers · Server actions│
                         │  Service layer (thin handlers)              │
                         └──┬──────────┬──────────┬─────────┬──────────┘
                            │          │          │         │
        ┌───────────────────▼──┐  ┌────▼─────┐ ┌──▼──────┐ ┌▼──────────────┐
        │ Supabase             │  │ Upstash  │ │ Stripe  │ │ apps/vision    │
        │ Postgres+RLS/Auth/   │  │ Redis    │ │ Billing │ │ FastAPI+OpenCV │
        │ Storage/Realtime     │  │ cache/   │ │         │ │ grade-potential│
        └──────────▲───────────┘  │ locks/   │ └─────────┘ └───────────────┘
                   │              │ rate-lim │
        ┌──────────┴───────────┐  └──────────┘
        │ Trigger.dev jobs     │        External data via @psr/providers adapters:
        │ sync/snapshots/alerts│        Catalog · Recognition · RawPricing · GradedPricing
        └──────────────────────┘        Population · Certification · Marketplace
```

## Layering (web app)

```
Route handler / Server action   ← thin: parse (Zod) → authorize → call service → shape ApiResponse
        │
   Service layer (src/server/services/*)  ← business logic, transactions, entitlement checks
        │
   Data access (src/server/db/*, @psr/database)  +  Providers (@psr/providers)
        │
   Supabase (RLS) · Redis · Stripe · Vision service
```

Rules enforced by structure & lint:
- Client components never touch the database or service-role key.
- Provider response shapes never leak past `@psr/providers` — everything is normalized.
- Business logic lives in services, not components or route handlers.
- All external I/O goes through adapters with timeouts, retries, and circuit breakers.

## Packages

| Package | Responsibility |
|---|---|
| `@psr/config` | Zod-validated env, runtime flags, `DATA_MODE`, plan defaults |
| `@psr/types` | Domain types, money (integer minor units), API envelope, DB types |
| `@psr/database` | SQL migrations, RLS policies, seed, generated types |
| `@psr/providers` | Adapter interfaces, registry, circuit breaker, fixtures, Pokémon TCG adapter |
| `@psr/grading-rules` | Versioned grading-company rule sets + centering thresholds |
| `@psr/ui` | shadcn-style primitives, tokens, theme |
| `@psr/testing` | Fixtures, MSW handlers, factories |

## Provider architecture

`ProviderRegistry` resolves each capability (`catalog`, `recognition`, `rawPricing`, …) to a
configured adapter chosen by env (`CATALOG_PROVIDER=...`). Each adapter is wrapped with:

- **Timeout** (per-op budget), **retry** with exponential backoff + jitter,
- **Circuit breaker** (open on consecutive failures, half-open probe),
- **Cache** (Redis, cache-aware clients), **usage/credit tracking** (`provider_request_logs`),
- **Typed errors** (`ProviderError` with stable codes) and **health status**.

In `DATA_MODE=demo`, the registry returns fixture adapters that read from `@psr/testing`
fixtures — the app is fully navigable with zero paid keys, and all values are badged as demo.

## Data model highlights

- Canonical `sets` / `cards` / `card_variants` with `external_id_mappings` (unique on
  `provider + entity_type + external_id`). Provider IDs are never PKs.
- `price_points` are unique per (provider, card, variant, market, currency, condition,
  grading_company, grade, date) to prevent duplicate daily snapshots.
- Money stored as integer minor units + currency code; conversion rate + timestamp preserved.
- Portfolio snapshots are daily, durable, and idempotent.

## Background jobs (Trigger.dev)

Idempotent, retryable, concurrency-controlled, rate-limit aware. Distributed locks via Redis.
Jobs: catalog sync, price refresh (priority queue), portfolio snapshots, alert evaluation,
notification/email delivery, import/export, stale-image cleanup, provider-health, subscription
reconciliation, currency refresh, grade-report processing.

## Query performance notes
- Card search backed by trigram + generated search columns; list endpoints are cursor-paginated.
- Collection value computed from a materialized latest-price view to avoid N+1 across items.
- Dashboards read from `portfolio_snapshots`, never recompute provider calls on render.
- Provider calls never happen during ordinary page render when cached data exists.

## Security posture
See `SECURITY.md`. Summary: defense in depth (server authz + RLS), signed URLs for private
images, strict input validation, rate limiting on all sensitive/provider-backed routes, webhook
signature verification + idempotency, CSP + secure headers, log sanitization.
