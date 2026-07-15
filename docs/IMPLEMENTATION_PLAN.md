# Pokémon Stock Radar — Implementation Plan

> Status: living document. See `PROGRESS.md` for what is actually built.

## 0. Scope & guiding principles

Pokémon Stock Radar (PSR) is a subscription SaaS for the Pokémon TCG: identify cards by
camera, track raw and graded collections, value portfolios over time, estimate grade
potential with computer vision, and surface market intelligence.

Guiding principles:

1. **Server-authoritative.** Entitlements, subscription state, and authorization are never
   trusted from the client. RLS is the last line of defense, not the only one.
2. **Provider-agnostic.** External data lives behind normalized adapter interfaces. Swapping a
   provider is a configuration change, not a rewrite.
3. **No fake live data.** When live credentials are absent, the app runs in a clearly labeled
   **demo/fixture mode**. Fixture prices are never presented as current market values.
4. **Honest grading.** We estimate; we never guarantee. Every grade report ships a disclaimer.
5. **Configurable limits.** Plan entitlements live in the database, not in code constants.

## 1. Phase breakdown & acceptance criteria

### Phase 1 — Foundation ✅ (this session, substantially complete)
- Monorepo (pnpm workspaces), TypeScript strict, Tailwind, shared UI primitives.
- Environment validation with Zod (`@psr/config`).
- Supabase clients (browser, server, admin) + auth middleware.
- Full database schema, indexes, constraints, RLS policies (SQL migrations).
- Auth flows (email/password, magic link, OAuth-ready), profiles, onboarding shell.
- Base navigation (desktop sidebar + mobile bottom nav), theming, empty/loading/error states.
- Docs + CI workflows.
- **Acceptance:** app boots locally with no paid keys; users can sign up; RLS blocks
  cross-user reads; typecheck + lint + unit tests pass.

### Phase 2 — Catalog
- `sets`, `cards`, `card_variants`, `external_id_mappings` with canonical slugs.
- Provider adapters: `CardCatalogProvider` (fixtures + Pokémon TCG API adapter).
- Catalog sync job (full + incremental), dedup, conflict reporting.
- Fuzzy search (name, number `199/165`, `Charizard 199`), card & set pages.
- **Acceptance:** browse sets, open a card page, search tolerant of typos/abbreviations.

### Phase 3 — Collections
- `collections`, `collection_items`, tags, manual add/edit, filters, sorting, binder view.
- Portfolio valuation service (cost basis, unrealized gain/loss).
- CSV import wizard + export (background jobs).
- **Acceptance:** add cards manually, organize into collections, import/export CSV.

### Phase 4 — Pricing
- `price_points`, raw + graded normalization, provider adapters, history charts.
- Daily snapshot job (priority queue, rate-limit aware, idempotent, locked).
- Portfolio snapshots, market pages.
- **Acceptance:** card pages show raw + graded prices and historical charts; portfolio value
  over time renders; data-freshness badges visible.

### Phase 5 — Billing
- Stripe products/prices, Checkout, Customer Portal, webhooks (idempotent, verified).
- `subscriptions`, `entitlements`, `usage_periods`; server-side feature gates + usage meters.
- **Acceptance:** upgrade via (mock) Stripe; entitlements enforced server-side; webhooks
  replay-safe.

### Phase 6 — Quick scanning
- Mobile camera UI, image-quality gates, recognition provider adapter, candidate confirmation,
  batch scanning, add-to-collection.
- **Acceptance:** scan a fixture image, confirm the card+variant, add to collection.

### Phase 7 — Grade Potential
- Guided multi-capture flow, Python vision service (centering, corners, edges, surface,
  structural), rules engine, reports, expected-value calculator.
- **Acceptance:** poor images rejected with specific guidance; report shows range +
  confidence + evidence + disclaimer.

### Phase 8 — Watchlists & alerts
- `watchlist_items`, `price_alerts`, `notifications`; alert evaluation job; digests; email.
- **Acceptance:** create an alert; alert fires from a snapshot; in-app + email delivery.

### Phase 9 — Admin & observability
- Admin dashboard (MRR, usage, provider/job health), feature flags, audit logs, Sentry, PostHog.

### Phase 10 — Hardening
- Security, accessibility (WCAG 2.2 AA), performance, full test suite, deployment docs,
  production-readiness checklist.

## 2. Cross-cutting workstreams
- **Types** (`@psr/types`): domain types shared across web + jobs; DB-generated types.
- **Providers** (`@psr/providers`): adapter interfaces, registry, circuit breaker, fixtures.
- **Grading rules** (`@psr/grading-rules`): versioned, sourced grading-company rule sets.
- **Testing** (`@psr/testing`): fixtures, MSW handlers, factory helpers.

## 3. Decisions log (ADR-lite)
- **Monorepo over polyrepo** — shared types/providers, single CI, atomic changes.
- **Supabase Postgres + RLS** — auth, storage, row security in one platform; SQL-first schema.
- **Vision as a separate Python service** — OpenCV/Torch ecosystem; independently deployable;
  keeps the Node bundle lean.
- **Prices stored as integer minor units** — no float money math (`packages/types/money`).
- **Provider IDs never used as PKs** — canonical internal UUIDs + `external_id_mappings`.
- **Demo mode is first-class** — `DATA_MODE=demo` selects fixture adapters everywhere.

## 4. Definition of done (per PR)
`pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green; new server routes validated
with Zod; new tables ship RLS + tests; no secrets committed; `PROGRESS.md` updated.
