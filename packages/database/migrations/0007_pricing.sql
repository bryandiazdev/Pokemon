-- 0007_pricing.sql
-- Purpose: price points, portfolio snapshots, and FX rates.
-- ROLLBACK: drop table currency_rates, portfolio_snapshots, price_points;

-- All monetary columns are INTEGER minor units in the row's `currency`.
create table if not exists price_points (
  id                  uuid primary key default gen_random_uuid(),
  card_id             uuid        not null references cards(id) on delete cascade,
  card_variant_id     uuid        references card_variants(id) on delete cascade,
  provider            text        not null,
  market              text        not null default 'default',
  currency            char(3)     not null default 'USD',
  condition           raw_condition,
  grading_company     grading_company,
  grade               numeric(4,1),
  value_minor         integer     not null,
  low_value_minor     integer,
  high_value_minor    integer,
  sample_size         integer,
  valuation_type      valuation_type not null default 'market',
  recorded_for_date   date        not null,
  provider_updated_at timestamptz,
  created_at          timestamptz not null default now(),
  constraint chk_price_points_values_nonneg check (
    value_minor >= 0 and
    (low_value_minor is null or low_value_minor >= 0) and
    (high_value_minor is null or high_value_minor >= 0)
  )
);

-- CRITICAL: prevent duplicate daily values for the same logical series.
-- Nullable dimensions (card_variant_id, condition, grading_company, grade) are
-- COALESCE'd to sentinels so that NULLs participate in uniqueness instead of
-- defeating it (in Postgres, NULL != NULL, so a plain UNIQUE would allow dupes).
-- immutable_enum_label() (from 0001) is used so the enum dimensions can appear in
-- this expression index (the built-in enum->text cast is only STABLE).
create unique index if not exists uq_price_points_daily on price_points (
  provider,
  card_id,
  coalesce(card_variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
  market,
  currency,
  coalesce(immutable_enum_label(condition), '__none__'),
  coalesce(immutable_enum_label(grading_company), '__none__'),
  coalesce(grade, -1),
  recorded_for_date
);

create index if not exists idx_price_points_card_date on price_points(card_id, recorded_for_date);
create index if not exists idx_price_points_variant_date on price_points(card_variant_id, recorded_for_date);

comment on index uq_price_points_daily is
  'Deduplicates one value per (series dimensions, day); COALESCE sentinels make NULL dimensions comparable.';

-- Daily rollups of a user's portfolio value. One row per user per day.
create table if not exists portfolio_snapshots (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid        not null references auth.users(id) on delete cascade,
  snapshot_date           date        not null,
  total_market_value_minor  integer   not null default 0,
  total_cost_basis_minor    integer   not null default 0,
  unrealized_gain_minor     integer   not null default 0,
  card_count              integer     not null default 0,
  graded_card_count       integer     not null default 0,
  raw_card_count          integer     not null default 0,
  breakdown               jsonb       not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create index if not exists idx_portfolio_snapshots_user on portfolio_snapshots(user_id, snapshot_date);

-- FX rates: 1 unit of `base` = `rate` units of `quote` as of `as_of`.
create table if not exists currency_rates (
  id         uuid primary key default gen_random_uuid(),
  base       char(3)     not null,
  quote      char(3)     not null,
  rate       numeric(18,8) not null,
  as_of      date        not null,
  created_at timestamptz not null default now(),
  constraint chk_currency_rates_rate_positive check (rate > 0),
  unique (base, quote, as_of)
);

create index if not exists idx_currency_rates_pair on currency_rates(base, quote, as_of);
