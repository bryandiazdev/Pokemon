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
