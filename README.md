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

### Real cards + real prices — just add one key

Get a free key (30 seconds, no card) at https://dev.pokemontcg.io/ and set **only** this in
`.env.local`:

```bash
POKEMON_TCG_API_KEY=your_free_key_here
```

The catalog and raw pricing switch to **live automatically** — real search, cards, images, raw
prices, price history, and portfolio values, with a green "Live data" indicator and honest
per-datum freshness badges. No Supabase needed (keep `DATA_MODE=demo`). Graded/PSA prices and
population remain clearly-labeled sample data (a free key can't provide real graded sold prices —
that needs a licensed source). Recognition stays on the demo adapter.

Optional — the Python vision service (for live grade scans):

```bash
cd apps/vision
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

Optional — a real database (auth + persistence):

```bash
supabase start                 # Supabase CLI + Docker
export DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres
pnpm db:migrate && pnpm db:seed
# set NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY / SUPABASE_SERVICE_ROLE_KEY, DATA_MODE=live
```

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
