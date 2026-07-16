-- Pokémon Stock Radar — consolidated schema (all 12 migrations, in order).
-- Verified to apply cleanly against Postgres 15 (Supabase) and to provision
-- profile + entitlements + default collection on signup via handle_new_user().
-- Paste this whole file into your hosted Supabase → SQL Editor → Run.
-- Safe to re-run (idempotent: create-if-not-exists + guarded policies).

-- ============================================================
-- packages/database/migrations/0001_extensions.sql
-- ============================================================
-- 0001_extensions.sql
-- Purpose: enable required Postgres extensions and a shared updated_at trigger helper.
-- ROLLBACK: drop function set_updated_at(); drop extension vector, pg_trgm, citext, pgcrypto;

-- pgcrypto provides gen_random_uuid() for canonical UUID primary keys.
create extension if not exists pgcrypto;

-- citext for case-insensitive text (e.g. slugs, emails) where useful.
create extension if not exists citext;

-- pg_trgm powers fuzzy / trigram search over card names and numbers.
create extension if not exists pg_trgm;

-- pgvector for future embedding-based recognition search. Guarded: not all
-- environments ship the extension, so this is best-effort.
do $$
begin
  create extension if not exists vector;
exception
  when others then
    raise notice 'vector extension unavailable, skipping: %', sqlerrm;
end;
$$;

-- Shared trigger function: stamp updated_at = now() on any UPDATE.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function set_updated_at() is 'BEFORE UPDATE trigger helper; sets updated_at to now().';

-- Immutable enum -> text helper. The built-in enum output cast is only STABLE,
-- which Postgres rejects inside index expressions. This wrapper is safe to mark
-- IMMUTABLE for our purposes (we never rename enum labels), enabling enum columns
-- to participate in expression-based unique indexes (see price_points dedupe index).
create or replace function immutable_enum_label(anyenum)
returns text
language sql
immutable
as $$ select $1::text $$;

comment on function immutable_enum_label(anyenum) is
  'IMMUTABLE enum->text for use in index expressions (e.g. price_points daily dedupe).';

-- ============================================================
-- packages/database/migrations/0002_enums.sql
-- ============================================================
-- 0002_enums.sql
-- Purpose: create stable Postgres enum types shared across the schema.
-- ROLLBACK: drop type <each enum> cascade; (see list below)

-- Helper to create an enum only if it does not already exist (idempotent).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type subscription_status as enum
      ('trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid');
  end if;

  if not exists (select 1 from pg_type where typname = 'plan_tier') then
    create type plan_tier as enum ('free','collector_pro');
  end if;

  if not exists (select 1 from pg_type where typname = 'ownership_type') then
    create type ownership_type as enum ('raw','graded');
  end if;

  if not exists (select 1 from pg_type where typname = 'grading_company') then
    create type grading_company as enum ('psa','bgs','cgc','sgc','tag','ace','other');
  end if;

  if not exists (select 1 from pg_type where typname = 'raw_condition') then
    create type raw_condition as enum
      ('near_mint','lightly_played','moderately_played','heavily_played','damaged','unspecified');
  end if;

  if not exists (select 1 from pg_type where typname = 'card_finish') then
    create type card_finish as enum
      ('normal','holo','reverse_holo','first_edition','unlimited','shadowless','other');
  end if;

  if not exists (select 1 from pg_type where typname = 'scan_type') then
    create type scan_type as enum ('quick','grade');
  end if;

  if not exists (select 1 from pg_type where typname = 'scan_status') then
    create type scan_status as enum
      ('pending','processing','awaiting_confirmation','completed','failed','abandoned');
  end if;

  if not exists (select 1 from pg_type where typname = 'capture_type') then
    create type capture_type as enum
      ('front','back','front_angled','back_angled',
       'corner_tl','corner_tr','corner_bl','corner_br',
       'edge_top','edge_bottom','edge_left','edge_right','surface_video');
  end if;

  if not exists (select 1 from pg_type where typname = 'alert_direction') then
    create type alert_direction as enum ('above','below','pct_increase','pct_decrease');
  end if;

  if not exists (select 1 from pg_type where typname = 'alert_cadence') then
    create type alert_cadence as enum ('immediate','daily','weekly');
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type notification_type as enum
      ('price_alert','digest','system','grade_report','import','export');
  end if;

  if not exists (select 1 from pg_type where typname = 'valuation_type') then
    create type valuation_type as enum ('market','low','high','mid','estimate');
  end if;

  if not exists (select 1 from pg_type where typname = 'collection_visibility') then
    create type collection_visibility as enum ('private','unlisted','public');
  end if;

  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status as enum ('queued','running','succeeded','failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'data_quality_severity') then
    create type data_quality_severity as enum ('info','warning','critical');
  end if;

  -- The 6 allowed submission recommendation strings surfaced by the grading engine.
  if not exists (select 1 from pg_type where typname = 'submission_recommendation') then
    create type submission_recommendation as enum
      ('submit','do_not_submit','borderline','submit_high_value_only',
       'crossover','regrade');
  end if;
end;
$$;

-- ============================================================
-- packages/database/migrations/0003_profiles_auth.sql
-- ============================================================
-- 0003_profiles_auth.sql
-- Purpose: user profiles, admin roles, and the new-user provisioning trigger.
-- ROLLBACK: drop trigger on_auth_user_created on auth.users; drop function handle_new_user();
--           drop table admin_roles; drop table profiles;

create table if not exists profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  display_name            text,
  avatar_url              text,
  preferred_currency      char(3)     not null default 'USD',
  preferred_language      text        not null default 'en',
  timezone                text        not null default 'UTC',
  is_admin                boolean     not null default false,
  terms_accepted_at       timestamptz,
  privacy_accepted_at     timestamptz,
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table profiles is 'One row per auth user; created automatically by handle_new_user().';

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Server-verified admin grants. Presence of a row (or profiles.is_admin) grants admin.
create table if not exists admin_roles (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  role       text        not null default 'admin',
  granted_at timestamptz not null default now(),
  granted_by uuid        references auth.users(id) on delete set null,
  primary key (user_id, role)
);

comment on table admin_roles is 'Server-side admin verification; never writable by end users.';

-- Provision default rows for a newly created auth user. Runs as SECURITY DEFINER so
-- it can insert regardless of the invoking role; guarded with ON CONFLICT so re-runs
-- and races are harmless.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_collection_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  -- Default free-tier entitlements.
  insert into public.entitlements (user_id, plan)
  values (new.id, 'free')
  on conflict (user_id) do nothing;

  -- Default email preferences.
  insert into public.email_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  -- Default "My Collection".
  insert into public.collections (user_id, name, is_default, visibility)
  values (new.id, 'My Collection', true, 'private')
  on conflict do nothing
  returning id into new_collection_id;

  return new;
end;
$$;

comment on function handle_new_user() is 'AFTER INSERT on auth.users: provisions profile, entitlements, email prefs, default collection.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- packages/database/migrations/0004_billing.sql
-- ============================================================
-- 0004_billing.sql
-- Purpose: Stripe-backed subscriptions, entitlements, usage metering, webhook idempotency.
-- ROLLBACK: drop table stripe_webhook_events, usage_periods, entitlements, subscriptions;

create table if not exists subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid        not null references auth.users(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text        unique,
  stripe_price_id        text,
  status                 subscription_status not null default 'incomplete',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean     not null default false,
  trial_ends_at          timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_id on subscriptions(user_id);

drop trigger if exists trg_subscriptions_updated_at on subscriptions;
create trigger trg_subscriptions_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

-- Effective feature limits per user. -1 means "unlimited".
create table if not exists entitlements (
  user_id                    uuid primary key references auth.users(id) on delete cascade,
  plan                       plan_tier   not null default 'free',
  collection_limit           integer     not null default 100,
  quick_scan_monthly_limit   integer     not null default 30,
  grade_scan_monthly_limit   integer     not null default 3,
  alerts_limit               integer     not null default 5,
  history_days               integer     not null default 30,
  exports_enabled            boolean     not null default false,
  advanced_analytics_enabled boolean     not null default false,
  batch_scanning_enabled     boolean     not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  -- -1 sentinel for unlimited, otherwise non-negative.
  constraint chk_entitlements_collection_limit         check (collection_limit >= -1),
  constraint chk_entitlements_quick_scan_limit         check (quick_scan_monthly_limit >= -1),
  constraint chk_entitlements_grade_scan_limit         check (grade_scan_monthly_limit >= -1),
  constraint chk_entitlements_alerts_limit             check (alerts_limit >= -1),
  constraint chk_entitlements_history_days             check (history_days >= -1)
);

drop trigger if exists trg_entitlements_updated_at on entitlements;
create trigger trg_entitlements_updated_at
  before update on entitlements
  for each row execute function set_updated_at();

-- Per-billing-period usage counters used to enforce entitlement limits.
create table if not exists usage_periods (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users(id) on delete cascade,
  period_start          timestamptz not null,
  period_end            timestamptz not null,
  quick_scans_used      integer     not null default 0,
  grade_scans_used      integer     not null default 0,
  provider_credits_used integer     not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint chk_usage_period_range check (period_end > period_start),
  constraint chk_usage_counts_nonneg check (
    quick_scans_used >= 0 and grade_scans_used >= 0 and provider_credits_used >= 0
  ),
  unique (user_id, period_start)
);

create index if not exists idx_usage_periods_user_id on usage_periods(user_id);

drop trigger if exists trg_usage_periods_updated_at on usage_periods;
create trigger trg_usage_periods_updated_at
  before update on usage_periods
  for each row execute function set_updated_at();

-- Idempotency ledger for Stripe webhooks (event id is the Stripe event id).
create table if not exists stripe_webhook_events (
  id           text primary key,
  type         text,
  payload      jsonb,
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);

comment on table stripe_webhook_events is 'Stripe event idempotency ledger; service-role only.';

-- ============================================================
-- packages/database/migrations/0005_catalog.sql
-- ============================================================
-- 0005_catalog.sql
-- Purpose: canonical catalog — sets, cards, card variants, and external id mappings.
-- ROLLBACK: drop table external_id_mappings, card_variants, cards, sets;

create table if not exists sets (
  id             uuid primary key default gen_random_uuid(),
  name           text        not null,
  series         text,
  language       text        not null default 'en',
  printed_total  integer,
  total          integer,
  release_date   date,
  symbol_url     text,
  logo_url       text,
  canonical_slug text        not null,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists uq_sets_canonical_slug on sets(canonical_slug);
create index if not exists idx_sets_language on sets(language);

drop trigger if exists trg_sets_updated_at on sets;
create trigger trg_sets_updated_at
  before update on sets for each row execute function set_updated_at();

create table if not exists cards (
  id              uuid primary key default gen_random_uuid(),
  set_id          uuid        not null references sets(id) on delete cascade,
  name            text        not null,
  number          text,
  printed_number  text,
  rarity          text,
  supertype       text,
  subtypes        text[]      not null default '{}',
  language        text        not null default 'en',
  artist          text,
  regulation_mark text,
  image_small_url text,
  image_large_url text,
  canonical_slug  text        not null,
  metadata        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Normalized numeric portion of the card number for stable sorting / matching.
  normalized_number text generated always as
    (nullif(regexp_replace(coalesce(number, ''), '[^0-9]', '', 'g'), '')) stored
);

create unique index if not exists uq_cards_canonical_slug on cards(canonical_slug);
create index if not exists idx_cards_set_id on cards(set_id);
create index if not exists idx_cards_language on cards(language);
-- Trigram fuzzy search over card names.
create index if not exists idx_cards_name_trgm on cards using gin (name gin_trgm_ops);
-- Trigram over normalized number for tolerant number lookups.
create index if not exists idx_cards_normalized_number_trgm
  on cards using gin (normalized_number gin_trgm_ops);

drop trigger if exists trg_cards_updated_at on cards;
create trigger trg_cards_updated_at
  before update on cards for each row execute function set_updated_at();

create table if not exists card_variants (
  id           uuid primary key default gen_random_uuid(),
  card_id      uuid        not null references cards(id) on delete cascade,
  finish       card_finish not null default 'normal',
  edition      text,
  language     text        not null default 'en',
  stamp        text,
  variant_name text,
  metadata     jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_card_variants_card_id on card_variants(card_id);

drop trigger if exists trg_card_variants_updated_at on card_variants;
create trigger trg_card_variants_updated_at
  before update on card_variants for each row execute function set_updated_at();

-- Maps our canonical internal ids to provider-specific external ids.
create table if not exists external_id_mappings (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text        not null,   -- e.g. 'set','card','card_variant'
  internal_id  uuid        not null,
  provider     text        not null,   -- e.g. 'pokemontcg','tcgplayer'
  external_id  text        not null,
  external_url text,
  metadata     jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- One external id per (provider, entity_type) pair.
  constraint uq_external_id_mappings unique (provider, entity_type, external_id)
);

create index if not exists idx_external_id_mappings_internal on external_id_mappings(entity_type, internal_id);

drop trigger if exists trg_external_id_mappings_updated_at on external_id_mappings;
create trigger trg_external_id_mappings_updated_at
  before update on external_id_mappings for each row execute function set_updated_at();

-- ============================================================
-- packages/database/migrations/0006_collections.sql
-- ============================================================
-- 0006_collections.sql
-- Purpose: user collections, items, user tags, and the item<->tag join.
-- ROLLBACK: drop table collection_item_tags, user_tags, collection_items, collections;

create table if not exists collections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  description text,
  is_default  boolean     not null default false,
  visibility  collection_visibility not null default 'private',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_collections_user_id on collections(user_id);
-- At most one default collection per user.
create unique index if not exists uq_collections_default_per_user
  on collections(user_id) where is_default;

drop trigger if exists trg_collections_updated_at on collections;
create trigger trg_collections_updated_at
  before update on collections for each row execute function set_updated_at();

-- All money columns are INTEGER minor units (e.g. cents). No floats for money.
create table if not exists collection_items (
  id                    uuid primary key default gen_random_uuid(),
  collection_id         uuid        not null references collections(id) on delete cascade,
  user_id               uuid        not null references auth.users(id) on delete cascade, -- denormalized for RLS
  card_id               uuid        not null references cards(id) on delete restrict,
  card_variant_id       uuid        references card_variants(id) on delete set null,
  quantity              integer     not null default 1,
  ownership_type        ownership_type not null default 'raw',
  raw_condition         raw_condition,
  grading_company       grading_company,
  grade                 numeric(4,1),
  grade_label           text,
  certification_number  text,
  purchase_price_minor  integer,
  purchase_currency     char(3)     not null default 'USD',
  purchase_date         date,
  acquisition_source    text,
  notes                 text,
  front_image_path      text,
  back_image_path       text,
  estimated_value_minor integer,
  valuation_price_point_id uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint chk_collection_items_quantity check (quantity > 0),
  constraint chk_collection_items_prices_nonneg check (
    (purchase_price_minor is null or purchase_price_minor >= 0) and
    (estimated_value_minor is null or estimated_value_minor >= 0)
  )
);

create index if not exists idx_collection_items_user_id on collection_items(user_id);
create index if not exists idx_collection_items_collection_id on collection_items(collection_id);
create index if not exists idx_collection_items_card_id on collection_items(card_id);
create index if not exists idx_collection_items_variant_id on collection_items(card_variant_id);

drop trigger if exists trg_collection_items_updated_at on collection_items;
create trigger trg_collection_items_updated_at
  before update on collection_items for each row execute function set_updated_at();

create table if not exists user_tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  color      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists idx_user_tags_user_id on user_tags(user_id);

drop trigger if exists trg_user_tags_updated_at on user_tags;
create trigger trg_user_tags_updated_at
  before update on user_tags for each row execute function set_updated_at();

-- Join table. Carries a denormalized user_id so RLS is a simple equality check.
create table if not exists collection_item_tags (
  collection_item_id uuid        not null references collection_items(id) on delete cascade,
  user_tag_id        uuid        not null references user_tags(id) on delete cascade,
  user_id            uuid        not null references auth.users(id) on delete cascade, -- denormalized for RLS
  created_at         timestamptz not null default now(),
  primary key (collection_item_id, user_tag_id)
);

create index if not exists idx_collection_item_tags_user_id on collection_item_tags(user_id);
create index if not exists idx_collection_item_tags_tag on collection_item_tags(user_tag_id);

-- ============================================================
-- packages/database/migrations/0007_pricing.sql
-- ============================================================
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

-- ============================================================
-- packages/database/migrations/0008_scanning_grading.sql
-- ============================================================
-- 0008_scanning_grading.sql
-- Purpose: scan sessions/images, recognition, grade reports/findings, actual results,
--          and a separately-consented training data table.
-- ROLLBACK: drop table grade_training_examples, actual_grading_results, grade_findings,
--           grade_reports, recognition_candidates, scan_images, scan_sessions;

create table if not exists scan_sessions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users(id) on delete cascade,
  scan_type             scan_type   not null,
  status                scan_status not null default 'pending',
  source                text,
  selected_card_id      uuid        references cards(id) on delete set null,
  recognition_confidence numeric(5,4),
  provider              text,
  provider_cost         integer,     -- provider credits/cost in minor units
  error_code            text,
  started_at            timestamptz not null default now(),
  completed_at          timestamptz
);

create index if not exists idx_scan_sessions_user on scan_sessions(user_id);
create index if not exists idx_scan_sessions_status on scan_sessions(status);

create table if not exists scan_images (
  id               uuid primary key default gen_random_uuid(),
  scan_session_id  uuid        not null references scan_sessions(id) on delete cascade,
  user_id          uuid        not null references auth.users(id) on delete cascade, -- denormalized for RLS
  capture_type     capture_type not null,
  storage_path     text        not null,
  width            integer,
  height           integer,
  blur_score       numeric(5,4),
  glare_score      numeric(5,4),
  exposure_score   numeric(5,4),
  perspective_score numeric(5,4),
  accepted         boolean     not null default false,
  rejection_reason text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_scan_images_session on scan_images(scan_session_id);
create index if not exists idx_scan_images_user on scan_images(user_id);

create table if not exists recognition_candidates (
  id              uuid primary key default gen_random_uuid(),
  scan_session_id uuid        not null references scan_sessions(id) on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade, -- denormalized for RLS
  card_id         uuid        references cards(id) on delete set null,
  provider        text,
  confidence      numeric(5,4),
  ranking         integer,
  evidence        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_recognition_candidates_session on recognition_candidates(scan_session_id);
create index if not exists idx_recognition_candidates_user on recognition_candidates(user_id);

create table if not exists grade_reports (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid        not null references auth.users(id) on delete cascade,
  scan_session_id          uuid        references scan_sessions(id) on delete set null,
  card_id                  uuid        references cards(id) on delete set null,
  estimated_min_grade      numeric(4,1),
  estimated_max_grade      numeric(4,1),
  estimated_ceiling        numeric(4,1),
  overall_confidence       numeric(5,4),
  centering_score          numeric(5,4),
  corner_score             numeric(5,4),
  edge_score               numeric(5,4),
  surface_score            numeric(5,4),
  structural_score         numeric(5,4),
  image_quality_score      numeric(5,4),
  submission_recommendation submission_recommendation,
  model_version            text,
  rules_version            text,
  disclaimer_version       text,
  share_token              text        unique,
  share_expires_at         timestamptz,
  created_at               timestamptz not null default now()
);

create index if not exists idx_grade_reports_user on grade_reports(user_id);
create index if not exists idx_grade_reports_session on grade_reports(scan_session_id);

create table if not exists grade_findings (
  id              uuid primary key default gen_random_uuid(),
  grade_report_id uuid        not null references grade_reports(id) on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade, -- denormalized for RLS
  category        text        not null,
  severity        data_quality_severity not null default 'info',
  title           text,
  explanation     text,
  capture_type    capture_type,
  bounding_box    jsonb,
  mask_path       text,
  confidence      numeric(5,4),
  grade_cap       numeric(4,1),
  created_at      timestamptz not null default now()
);

create index if not exists idx_grade_findings_report on grade_findings(grade_report_id);
create index if not exists idx_grade_findings_user on grade_findings(user_id);

create table if not exists actual_grading_results (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid        not null references auth.users(id) on delete cascade,
  grade_report_id             uuid        references grade_reports(id) on delete set null,
  grading_company             grading_company not null,
  actual_grade                numeric(4,1),
  certification_number        text,
  submitted_at                timestamptz,
  returned_at                 timestamptz,
  consent_for_model_improvement boolean   not null default false,
  created_at                  timestamptz not null default now()
);

create index if not exists idx_actual_grading_results_user on actual_grading_results(user_id);

-- Separately-stored, explicitly-consented training data. Deletable by the owner
-- (right to withdraw). Only rows a user consented to should ever land here.
create table if not exists grade_training_examples (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  grade_report_id uuid        references grade_reports(id) on delete set null,
  scan_image_id   uuid        references scan_images(id) on delete set null,
  actual_grade    numeric(4,1),
  grading_company grading_company,
  label_payload   jsonb       not null default '{}'::jsonb,
  consented       boolean     not null default false,
  consented_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_grade_training_examples_user on grade_training_examples(user_id);

drop trigger if exists trg_grade_training_examples_updated_at on grade_training_examples;
create trigger trg_grade_training_examples_updated_at
  before update on grade_training_examples for each row execute function set_updated_at();

comment on table grade_training_examples is
  'Consented ML training data; owner-deletable to honor withdrawal of consent.';

-- ============================================================
-- packages/database/migrations/0009_watchlist_alerts_notifications.sql
-- ============================================================
-- 0009_watchlist_alerts_notifications.sql
-- Purpose: watchlists, price alerts, notifications, and per-user email preferences.
-- ROLLBACK: drop table email_preferences, notifications, price_alerts, watchlist_items;

create table if not exists watchlist_items (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid        not null references auth.users(id) on delete cascade,
  card_id               uuid        not null references cards(id) on delete cascade,
  card_variant_id       uuid        references card_variants(id) on delete cascade,
  target_condition      raw_condition,
  target_grading_company grading_company,
  target_grade          numeric(4,1),
  created_at            timestamptz not null default now()
);

create index if not exists idx_watchlist_items_user on watchlist_items(user_id);
create index if not exists idx_watchlist_items_card on watchlist_items(card_id);

create table if not exists price_alerts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  card_id           uuid        not null references cards(id) on delete cascade,
  card_variant_id   uuid        references card_variants(id) on delete cascade,
  condition         raw_condition,
  grading_company   grading_company,
  grade             numeric(4,1),
  direction         alert_direction not null,
  threshold         integer,          -- absolute price in minor units (for above/below)
  percentage_change numeric(6,2),     -- percent (for pct_increase/pct_decrease)
  cadence           alert_cadence not null default 'immediate',
  enabled           boolean     not null default true,
  last_triggered_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint chk_price_alerts_threshold_nonneg check (threshold is null or threshold >= 0)
);

create index if not exists idx_price_alerts_user on price_alerts(user_id);
-- Partial index for the alert evaluation job which only cares about enabled alerts.
create index if not exists idx_price_alerts_enabled on price_alerts(card_id) where enabled;

drop trigger if exists trg_price_alerts_updated_at on price_alerts;
create trigger trg_price_alerts_updated_at
  before update on price_alerts for each row execute function set_updated_at();

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  type       notification_type not null,
  title      text        not null,
  body       text,
  action_url text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on notifications(user_id, created_at desc);
-- Partial index for the common "unread notifications" query.
create index if not exists idx_notifications_unread on notifications(user_id) where read_at is null;

create table if not exists email_preferences (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  marketing    boolean     not null default false,
  price_alerts boolean     not null default true,
  digests      boolean     not null default true,
  product      boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_email_preferences_updated_at on email_preferences;
create trigger trg_email_preferences_updated_at
  before update on email_preferences for each row execute function set_updated_at();

-- ============================================================
-- packages/database/migrations/0010_ops.sql
-- ============================================================
-- 0010_ops.sql
-- Purpose: operational tables — provider telemetry, jobs, flags, audit, imports/exports,
--          data-quality issues, saved searches, and API keys.
-- ROLLBACK: drop table api_keys, data_quality_issues, export_jobs, import_jobs,
--           saved_searches, audit_logs, feature_flags, background_jobs,
--           provider_sync_runs, provider_request_logs;

-- Sanitized provider telemetry. Contains NO user PII: no user_id, no card ids,
-- no request/response bodies — only operational metadata for cost/latency dashboards.
create table if not exists provider_request_logs (
  id           uuid primary key default gen_random_uuid(),
  provider     text        not null,
  operation    text        not null,
  status       text        not null,
  credits_used integer     not null default 0,
  duration_ms  integer,
  cache_hit    boolean     not null default false,
  error_code   text,
  created_at   timestamptz not null default now()
);

comment on table provider_request_logs is
  'Sanitized provider telemetry only. No user PII. Admin-readable, never end-user readable.';

create index if not exists idx_provider_request_logs_provider on provider_request_logs(provider, created_at desc);

create table if not exists provider_sync_runs (
  id             uuid primary key default gen_random_uuid(),
  provider       text        not null,
  entity_type    text,
  status         job_status  not null default 'queued',
  started_at     timestamptz,
  finished_at    timestamptz,
  records_synced integer     not null default 0,
  error_code     text,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_provider_sync_runs_provider on provider_sync_runs(provider, created_at desc);

create table if not exists background_jobs (
  id           uuid primary key default gen_random_uuid(),
  job_type     text        not null,
  status       job_status  not null default 'queued',
  payload      jsonb       not null default '{}'::jsonb,
  result       jsonb,
  error_code   text,
  attempts     integer     not null default 0,
  run_after    timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_background_jobs_status on background_jobs(status, run_after);

drop trigger if exists trg_background_jobs_updated_at on background_jobs;
create trigger trg_background_jobs_updated_at
  before update on background_jobs for each row execute function set_updated_at();

create table if not exists feature_flags (
  key        text primary key,
  enabled    boolean     not null default false,
  rollout    numeric(5,4) not null default 0,   -- 0..1 fraction
  payload    jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_feature_flags_rollout check (rollout >= 0 and rollout <= 1)
);

drop trigger if exists trg_feature_flags_updated_at on feature_flags;
create trigger trg_feature_flags_updated_at
  before update on feature_flags for each row execute function set_updated_at();

create table if not exists audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid        references auth.users(id) on delete set null,
  action        text        not null,
  entity_type   text,
  entity_id     text,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_audit_logs_actor on audit_logs(actor_user_id, created_at desc);
create index if not exists idx_audit_logs_entity on audit_logs(entity_type, entity_id);

create table if not exists saved_searches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  query      jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saved_searches_user on saved_searches(user_id);

drop trigger if exists trg_saved_searches_updated_at on saved_searches;
create trigger trg_saved_searches_updated_at
  before update on saved_searches for each row execute function set_updated_at();

create table if not exists import_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  source        text,
  status        job_status  not null default 'queued',
  total_rows    integer     not null default 0,
  processed_rows integer    not null default 0,
  error_rows    integer     not null default 0,
  storage_path  text,
  result        jsonb,
  error_code    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_import_jobs_user on import_jobs(user_id);

drop trigger if exists trg_import_jobs_updated_at on import_jobs;
create trigger trg_import_jobs_updated_at
  before update on import_jobs for each row execute function set_updated_at();

create table if not exists export_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  format       text,
  status       job_status  not null default 'queued',
  storage_path text,
  result       jsonb,
  error_code   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_export_jobs_user on export_jobs(user_id);

drop trigger if exists trg_export_jobs_updated_at on export_jobs;
create trigger trg_export_jobs_updated_at
  before update on export_jobs for each row execute function set_updated_at();

create table if not exists data_quality_issues (
  id          uuid primary key default gen_random_uuid(),
  entity_type text        not null,
  entity_id   text,
  issue_code  text        not null,
  severity    data_quality_severity not null default 'warning',
  details     jsonb       not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_data_quality_issues_entity on data_quality_issues(entity_type, entity_id);
create index if not exists idx_data_quality_issues_open on data_quality_issues(severity) where resolved_at is null;

-- Future public API keys. Only a hash is stored, never the raw key.
create table if not exists api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  name         text,
  hashed_key   text        not null unique,
  prefix       text        not null,
  scopes       text[]      not null default '{}',
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_api_keys_user on api_keys(user_id);
create index if not exists idx_api_keys_prefix on api_keys(prefix);

comment on table api_keys is 'Public API keys; stores only a hash of the secret, never the raw key.';

-- ============================================================
-- packages/database/migrations/0011_rls.sql
-- ============================================================
-- 0011_rls.sql
-- Purpose: Row Level Security for EVERY table. This is the security backbone.
-- ROLLBACK: alter table <each> disable row level security; drop policy ... ; drop function is_admin();
--
-- Model:
--  * Owner tables: a user may only touch rows where user_id (or profiles.id) = auth.uid().
--  * Child tables without a natural user_id carry a DENORMALIZED user_id, so their
--    policies are simple equality checks (no correlated EXISTS needed).
--  * Catalog/market tables: world-readable (anon + authenticated) SELECT, no client writes.
--  * Ops tables: writes never exposed to clients; admin-only SELECT via is_admin().
--  * The Supabase SERVICE ROLE bypasses RLS entirely, so we deliberately create NO
--    insert/update/delete policies on catalog/pricing/ops tables — writes are denied by
--    default for anon/authenticated and performed only by trusted server code.

-- ---------------------------------------------------------------------------
-- Admin helper. SECURITY DEFINER so it can read admin_roles/profiles under RLS.
-- ---------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_roles ar where ar.user_id = auth.uid()
  ) or exists (
    select 1 from profiles p where p.id = auth.uid() and p.is_admin
  );
$$;

comment on function is_admin() is 'True if the current auth.uid() is an admin (admin_roles row or profiles.is_admin).';

-- ---------------------------------------------------------------------------
-- Enable RLS on EVERY table (explicit per-table for auditability).
-- ---------------------------------------------------------------------------
alter table profiles                enable row level security;
alter table admin_roles             enable row level security;
alter table subscriptions           enable row level security;
alter table entitlements            enable row level security;
alter table usage_periods           enable row level security;
alter table stripe_webhook_events   enable row level security;
alter table sets                    enable row level security;
alter table cards                   enable row level security;
alter table card_variants           enable row level security;
alter table external_id_mappings    enable row level security;
alter table collections             enable row level security;
alter table collection_items        enable row level security;
alter table user_tags               enable row level security;
alter table collection_item_tags    enable row level security;
alter table price_points            enable row level security;
alter table portfolio_snapshots     enable row level security;
alter table currency_rates          enable row level security;
alter table scan_sessions           enable row level security;
alter table scan_images             enable row level security;
alter table recognition_candidates  enable row level security;
alter table grade_reports           enable row level security;
alter table grade_findings          enable row level security;
alter table actual_grading_results  enable row level security;
alter table grade_training_examples enable row level security;
alter table watchlist_items         enable row level security;
alter table price_alerts            enable row level security;
alter table notifications           enable row level security;
alter table email_preferences       enable row level security;
alter table provider_request_logs   enable row level security;
alter table provider_sync_runs      enable row level security;
alter table background_jobs         enable row level security;
alter table feature_flags           enable row level security;
alter table audit_logs              enable row level security;
alter table saved_searches          enable row level security;
alter table import_jobs             enable row level security;
alter table export_jobs             enable row level security;
alter table data_quality_issues     enable row level security;
alter table api_keys                enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: user sees & updates only their own row. No insert/delete by users
-- (rows are provisioned by the handle_new_user trigger).
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Owner tables: full CRUD limited to rows owned by auth.uid().
-- Every table below carries a `user_id` column (denormalized on child tables).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  owner_tables text[] := array[
    'subscriptions','entitlements','usage_periods',
    'collections','collection_items','user_tags','collection_item_tags',
    'portfolio_snapshots',
    'scan_sessions','scan_images','recognition_candidates',
    'grade_reports','grade_findings','actual_grading_results','grade_training_examples',
    'watchlist_items','price_alerts','notifications','email_preferences',
    'saved_searches','import_jobs','export_jobs','api_keys'
  ];
begin
  foreach t in array owner_tables loop
    execute format('drop policy if exists %I on %I', t || '_owner_all', t);
    execute format(
      'create policy %I on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_owner_all', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catalog / market tables: world-readable SELECT (anon + authenticated).
-- No write policies => anon/authenticated writes denied; service role bypasses RLS.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  public_read_tables text[] := array[
    'sets','cards','card_variants','external_id_mappings',
    'price_points','currency_rates','feature_flags'
  ];
begin
  foreach t in array public_read_tables loop
    execute format('drop policy if exists %I on %I', t || '_public_read', t);
    execute format(
      'create policy %I on %I for select to anon, authenticated using (true)',
      t || '_public_read', t
    );
  end loop;
end;
$$;

-- Explicit statements below mirror the loop above so the catalog read policies are
-- greppable/auditable and obviously present:
--   create policy sets_public_read on sets for select using (true);
--   create policy cards_public_read on cards for select using (true);
--   create policy card_variants_public_read on card_variants for select using (true);
--   create policy price_points_public_read on price_points for select using (true);
--   create policy currency_rates_public_read on currency_rates for select using (true);

-- ---------------------------------------------------------------------------
-- Ops tables: admin-only SELECT. No client writes (service role bypasses RLS).
-- provider_request_logs is intentionally NOT readable by normal users.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  admin_read_tables text[] := array[
    'audit_logs','provider_request_logs','data_quality_issues',
    'background_jobs','provider_sync_runs'
  ];
begin
  foreach t in array admin_read_tables loop
    execute format('drop policy if exists %I on %I', t || '_admin_read', t);
    execute format(
      'create policy %I on %I for select to authenticated using (is_admin())',
      t || '_admin_read', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Deny-by-default tables (RLS on, NO policies): admin_roles, stripe_webhook_events.
-- Only the service role (which bypasses RLS) may read/write these. Left without
-- policies on purpose.
-- ---------------------------------------------------------------------------

-- ============================================================
-- packages/database/migrations/0012_indexes_perf.sql
-- ============================================================
-- 0012_indexes_perf.sql
-- Purpose: remaining performance indexes (FKs, common filters, search, partial indexes).
-- ROLLBACK: drop index <each index below>;

-- Foreign-key / hot-filter coverage not already created inline.
create index if not exists idx_subscriptions_status on subscriptions(status);
-- Partial index: the billing reconciler scans only live subscriptions.
create index if not exists idx_subscriptions_active on subscriptions(user_id)
  where status in ('trialing','active','past_due');

create index if not exists idx_collection_items_ownership on collection_items(user_id, ownership_type);

-- Grade report share-link lookups.
create index if not exists idx_grade_reports_share_token on grade_reports(share_token)
  where share_token is not null;

-- Watchlist variant coverage.
create index if not exists idx_watchlist_items_variant on watchlist_items(card_variant_id);

-- API key active lookups (unrevoked).
create index if not exists idx_api_keys_active on api_keys(prefix) where revoked_at is null;

-- Trigram search over set names for the catalog browser.
create index if not exists idx_sets_name_trgm on sets using gin (name gin_trgm_ops);

-- Background job dequeue: ready-to-run queued jobs.
create index if not exists idx_background_jobs_ready on background_jobs(run_after)
  where status = 'queued';

-- Notifications feed ordering already covered; add type filter for digests.
create index if not exists idx_notifications_type on notifications(user_id, type);

-- External id reverse lookup by provider.
create index if not exists idx_external_id_mappings_provider on external_id_mappings(provider, entity_type);

