# Progress

Updated continuously. ✅ done · 🟡 partial · ⬜ not started.

## Phase 1 — Foundation
- ✅ Monorepo (pnpm workspaces), root TS/ESLint/Prettier config
- ✅ Docs: implementation plan, architecture, data providers, grading methodology, security, deployment
- ✅ `@psr/config` — Zod env validation, DATA_MODE, plan defaults
- ✅ `@psr/types` — money (integer minor units), API envelope, domain + DB types
- ✅ `@psr/database` — full schema migrations, constraints, indexes, RLS, seed
- ✅ `@psr/providers` — adapter interfaces, registry, circuit breaker, fixtures, Pokémon TCG adapter
- ✅ `@psr/grading-rules` — versioned rules (PSA/BGS/CGC/SGC/TAG/ACE) + centering thresholds
- ✅ `@psr/ui` — tokens, theme, primitives (Button, Card, Badge, etc.)
- ✅ apps/web — Next.js App Router, Tailwind, marketing site, auth pages, app shell, dashboard (demo)
- ✅ apps/vision — FastAPI service, quality + centering endpoints (real OpenCV), tests
- ✅ CI workflow (typecheck/lint/test/build/vision/audit)
- 🟡 Supabase Auth wiring (clients + middleware present; live project optional)

## Phase 2 — Catalog
- ✅ Schema (sets/cards/variants/external mappings) + fixtures
- ✅ Catalog provider (fixtures + Pokémon TCG adapter) + search service (fuzzy)
- 🟡 Card/Set pages (implemented against fixtures) · sync job (interface + demo)

## Phase 3 — Collections
- ✅ Schema + RLS · 🟡 manual add/edit UI, portfolio valuation service, CSV import/export (services + partial UI)

## Phase 4 — Pricing
- ✅ Schema · 🟡 normalization + history charts (demo data) · ⬜ live daily snapshot job on Trigger.dev

## Phase 5 — Billing
- ✅ Schema (subscriptions/entitlements/usage) · 🟡 Stripe service + webhook handler + entitlement gates (mock-mode)

## Phase 6 — Quick scanning
- 🟡 Camera UI + quality gates + recognition adapter (demo) + confirmation flow

## Phase 7 — Grade Potential
- ✅ Vision service (quality, centering deterministic) · 🟡 corners/edges/surface heuristics · ✅ rules engine · 🟡 report UI + EV calculator

## Phase 8 — Watchlists & alerts
- ✅ Schema · 🟡 services · ⬜ live alert job + email delivery

## Phase 9 — Admin & observability
- ✅ Schema (audit/flags) · 🟡 admin dashboard shell · ⬜ full metrics

## Phase 10 — Hardening
- 🟡 security headers/CSP/rate-limit helpers · ⬜ full a11y + e2e sweep

## Test results (Phase 1 verification)
- `pnpm -r typecheck` — ✅ clean across all 8 workspace projects.
- Unit tests — ✅ all passing:
  - `@psr/types` 8 · `@psr/config` 3 · `@psr/grading-rules` 6 · `@psr/providers` 12
  - `@psr/web` 5 (entitlement gates) · `@psr/database` 89 schema (+4 RLS skipped w/o DB)
  - `apps/vision` 14 (pytest, real OpenCV fixtures) · ruff clean
- `pnpm --filter @psr/web build` — ✅ production build succeeds; every route compiled.
- Live smoke (demo mode) — ✅ homepage, `/api/search`, card pages, dashboard, `/api/grade/analyze`,
  CSV export, and typed validation errors all serve correctly.
- Database migrations verified against a real Postgres (idempotent apply; RLS confirmed user A
  cannot read user B's `collection_items`; `provider_request_logs` not readable by normal users).

## Known limitations
- No live provider keys in this build → runs in **demo mode** with clearly-labeled fixture data.
- Grading heuristics are conservative and partly experimental; no proprietary trained model ships.
- Some Phase 6–9 UIs are functional against fixtures; live integrations require the documented keys.
