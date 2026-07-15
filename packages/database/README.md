# @psr/database

SQL migrations, Row Level Security, generated TypeScript types, seed data, and an
RLS test suite for **Pokémon Stock Radar** (Supabase Postgres).

## What's in here

```
migrations/     Numbered, re-runnable SQL migrations (0001..0012)
seed/demo.sql   Clearly-labeled DEMO catalog + pricing fixtures
scripts/        migrate.mjs (apply migrations), seed.mjs (load demo data)
src/            TypeScript: Database types, enum constants, money/limit helpers
tests/          schema.test.ts (no DB, always runs) + rls.test.ts (gated)
```

## Migration approach

- Migrations are plain `.sql` files, numbered `NNNN_name.sql`, applied in sorted order.
- Each file starts with a one-line **ROLLBACK** note in its header comment.
- Files are written to be **re-runnable**: `create table if not exists`,
  `create index if not exists`, enum creation guarded by `pg_type` checks, and
  policies wrapped in `drop policy if exists` + `create policy`.
- `scripts/migrate.mjs` records applied files in a `schema_migrations` ledger and
  runs each file in its own transaction. Pass `--force` to re-apply everything.

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/postgres pnpm --filter @psr/database migrate
```

The `migrate`/`seed` scripts use the `pg` client. They assume a Supabase-style
database where the `auth` schema, `auth.users`, and `auth.uid()` already exist
(Supabase provides these). Against bare Postgres, create minimal stand-ins first —
see `tests/rls.test.ts` for exactly what the harness creates.

## Row Level Security model

RLS is enabled on **every** table (`migrations/0011_rls.sql`). Categories:

| Category | Tables | Policy |
| --- | --- | --- |
| **Owner** | profiles, subscriptions, entitlements, collections, collection_items, scan_*, grade_*, price_alerts, notifications, api_keys, … | `user_id = auth.uid()` for all CRUD. Child tables (scan_images, grade_findings, collection_item_tags, …) carry a **denormalized `user_id`** so policies stay simple equality checks. `profiles` keys on `id = auth.uid()`. |
| **Catalog / market** | sets, cards, card_variants, external_id_mappings, price_points, currency_rates, feature_flags | World-readable `SELECT` (`anon` + `authenticated`). **No** client write policies. |
| **Ops** | audit_logs, provider_request_logs, data_quality_issues, background_jobs, provider_sync_runs | Admin-only `SELECT` via `is_admin()`. No client writes. |
| **Deny-by-default** | admin_roles, stripe_webhook_events | RLS on, **no** policies. |

Writes to catalog / pricing / ops tables are performed only by trusted server code
using the Supabase **service role**, which **bypasses RLS**. That is why those
tables intentionally have no `INSERT/UPDATE/DELETE` policies for `anon`/`authenticated`
— absence of a policy denies the operation.

`is_admin()` returns true when `auth.uid()` has an `admin_roles` row or
`profiles.is_admin = true`. It (and `handle_new_user()`) are `SECURITY DEFINER`
with a pinned `search_path`.

New users are provisioned by an `AFTER INSERT` trigger on `auth.users`
(`handle_new_user()`): it creates a profile, default `free` entitlements, email
preferences, and a default "My Collection".

## Money

Every monetary column is an **INTEGER minor unit** (e.g. USD cents) — never a float.
Column names end in `_minor`. Use the helpers in `src/index.ts`
(`toMinorUnits`, `minorUnitsToDecimalString`).

## Types

`src/types.ts` hand-mirrors the schema as a Supabase-style `Database` type with
`Row`/`Insert`/`Update` per table plus `Enums`. Convenience aliases:

```ts
import type { Database, Tables, Card, CollectionItem } from '@psr/database';
type Cards = Tables<'cards'>; // === Card
```

## Seeding demo data

`seed/demo.sql` inserts **clearly-labeled DEMO** data (every row has
`metadata->>'demo' = 'true'`): a vintage Base Set (1999, EN), modern Paldean Fates
(2024, EN), a Japanese 151 set, and SWSH promos; a Base Set Charizard with a large
raw-vs-PSA10 gap, Pikachu (incl. reverse holo), a Mew ex alt art, plus graded price
points (PSA 8/9/10, BGS 9.5, CGC 10) with **30 days of daily history** so charts
render, and a demo USD→EUR rate. It uses fixed UUIDs and `ON CONFLICT DO NOTHING`,
so it is idempotent. It does **not** touch `auth.users`.

```bash
DATABASE_URL=postgres://... pnpm --filter @psr/database seed
```

## Tests

Two layers:

1. **`tests/schema.test.ts`** — pure text assertions over the migration SQL. No DB
   required; always runs in CI. Verifies RLS is enabled on every table, the
   `price_points` daily-dedupe unique index exists, `external_id_mappings`
   uniqueness, money columns are integers, `SECURITY DEFINER` functions pin
   `search_path`, `is_admin()` exists, catalog read policies exist, and
   `provider_request_logs` has no public read policy.

2. **`tests/rls.test.ts`** — live integration tests **gated behind `DATABASE_URL_TEST`**.
   Skipped when unset. When set, it applies all migrations against a throwaway
   database, creates two users, and asserts user A cannot read user B's
   `collection_items`, normal users cannot read `provider_request_logs`, and the
   catalog is readable.

```bash
# Always-green unit layer:
pnpm --filter @psr/database test

# Live RLS layer (throwaway DB):
DATABASE_URL_TEST=postgres://postgres:pw@localhost:5432/postgres \
  pnpm --filter @psr/database test:rls

# Types:
pnpm --filter @psr/database typecheck
```

### Running against local Supabase

```bash
supabase start
export DATABASE_URL="$(supabase status -o env | grep DB_URL | cut -d= -f2-)"
pnpm --filter @psr/database migrate
pnpm --filter @psr/database seed
```
