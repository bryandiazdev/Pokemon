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
