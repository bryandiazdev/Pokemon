# Pokémon Stock Radar

Scan it. Grade-check it. Track it. — a subscription SaaS for the Pokémon TCG:
identify cards by camera, track raw and graded collections, value portfolios over time,
estimate grade potential with computer vision, and follow market intelligence.

> **Independent tool.** Not affiliated with, endorsed, sponsored, or approved by Nintendo,
> The Pokémon Company, Game Freak, Creatures Inc., PSA, Beckett, CGC, SGC, TAG, ACE, or any
> pricing/data provider. Grade estimates are **not** guarantees — see
> [`docs/GRADING_METHODOLOGY.md`](docs/GRADING_METHODOLOGY.md).

## Monorepo layout

```
apps/
  web/       Next.js 15 App Router web app + PWA
  vision/    FastAPI + OpenCV grade-potential service (Python)
packages/
  config/        Zod env validation, DATA_MODE, plan defaults
  types/         Money (integer minor units), API envelope, domain types
  database/      SQL migrations, RLS, seed, generated TS types
  providers/     Provider adapter interfaces, registry, resilience, fixtures
  grading-rules/ Versioned grading rules, centering, expected-value engine
  ui/            Design tokens + cn helper
  testing/       Shared demo fixtures
```

See [`docs/`](docs) for the implementation plan, architecture, data-provider due diligence,
grading methodology, security model, and deployment guide.

## Quick start (no paid keys required)

The app defaults to **demo mode** (`DATA_MODE=demo`) — fully navigable with clearly-labeled
fixture data, zero secrets.

```bash
corepack enable && corepack prepare pnpm@9.15.9 --activate
pnpm install
cp .env.example .env.local
pnpm dev              # http://localhost:3000
```

### Real cards + real prices — free, no API key

Set **one** line in `.env.local`:

```bash
PROVIDER_PRESET=tcgdex
```

Catalog and raw pricing switch to **live** via [TCGdex](https://tcgdex.dev) — a free, **keyless**
API with the real Pokémon catalog, card images, and TCGplayer (USD) + Cardmarket (EUR) prices.
Real search, cards, images, raw prices, price history, and portfolio values, with a green "Live
data via TCGdex" indicator and honest per-datum freshness badges. No key, no Supabase, no cost.

> Graded/PSA prices and population remain clearly-labeled sample data — a free source can't provide
> real graded *sold* prices (those live in licensed data like PriceCharting). Recognition stays on
> the demo adapter.
>
> `pokemontcg.io` is now part of **Scrydex** and its commercial API is paid (~$29/mo). The legacy
> adapter still works if you set `POKEMON_TCG_API_KEY`, but `PROVIDER_PRESET=tcgdex` is the
> recommended free path.

Optional — the Python vision service (for live grade scans):

```bash
cd apps/vision
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

### Full real setup — accounts + persistence (verified end-to-end)

Real sign-up, sessions, and saved collections/scans need Supabase. Local Supabase
(Docker) makes this a one-time setup — no cloud account required:

```bash
supabase start                 # Supabase CLI + Docker (this repo's config.toml)
supabase status                # copy the API URL + publishable/secret keys

# apply the 12 migrations (schema + RLS + signup trigger) to the local DB:
for f in packages/database/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

Then put the values from `supabase status` into `apps/web/.env.local`:

```bash
DATA_MODE=live
PROVIDER_PRESET=tcgdex                       # free live cards + prices
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres
OPENAI_API_KEY=sk-...                        # optional but recommended for scanning
```

`pnpm dev`, then create an account at `/sign-up`. The signup trigger provisions
your profile, entitlements, and default collection. The scanner accepts a live
photo **or a camera-roll upload**, reads the card on-device (Tesseract) and —
when `OPENAI_API_KEY` is set — server-side with a vision model (far more
reliable on holo/foil cards), matches it against the live catalog, and saves
confirmed cards to your own RLS-scoped collection, valued at live prices.
Recognition follows the preset automatically (`catalog-ocr` when the catalog
is live); no separate `RECOGNITION_PROVIDER` line is needed.

> This repo's `supabase/config.toml` uses ports `5532x` (offset from the default
> `5432x`) so it can coexist with another local Supabase project on the same
> machine. Adjust if you like. Local email confirmation is disabled for dev;
> enable it (and the `/auth/callback` flow, already implemented) in production.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run the web app |
| `pnpm build` | Build packages + web app |
| `pnpm typecheck` | Typecheck every package |
| `pnpm test` | Run all unit tests |
| `pnpm --filter @psr/web test:e2e` | Playwright smoke tests (run `playwright install chromium` first) |
| `pnpm db:migrate` / `pnpm db:seed` | Apply migrations / seed demo data |
| `pnpm vision:dev` | Run the vision service |

## Verified in this build

- `pnpm -r typecheck` — clean across all 8 workspace projects.
- Unit tests: types 8 · config 3 · grading-rules 6 · providers 12 · web 5 · database 89 (+4 RLS,
  skipped without a DB) · vision 14.
- `pnpm --filter @psr/web build` — production build succeeds (all routes compiled).
- Live smoke: search, card pages, dashboard, grade analysis, CSV export, and typed validation
  errors all serve correctly in demo mode.

## Security & privacy

Server-authoritative authorization + Postgres RLS, signed URLs for private images, Zod-validated
inputs, rate-limit helpers, idempotent + signature-verified Stripe webhooks, CSP + secure headers,
log sanitization, account deletion + data export. See [`docs/SECURITY.md`](docs/SECURITY.md).
# Pokemon
