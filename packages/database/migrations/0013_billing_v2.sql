-- 0013_billing_v2.sql
-- Purpose: three-tier billing (free / collector / pro), Stripe customer linkage,
-- and race-safe usage metering functions.
-- REQUIRES: 0013_billing_enums.sql (the 'collector'/'pro' plan_tier values
-- must be committed before this file references them — Postgres forbids using
-- a new enum value inside the transaction that added it).
-- ROLLBACK: drop function consume_usage, release_usage, current_usage;
--           alter table profiles drop column stripe_customer_id;

-- 1. Stripe customer linkage on the profile (created before any subscription
--    exists, so checkout can reuse the same customer across attempts).
alter table profiles add column if not exists stripe_customer_id text;
create unique index if not exists uq_profiles_stripe_customer_id
  on profiles(stripe_customer_id) where stripe_customer_id is not null;

-- 2. Migrate legacy tier + refresh Free defaults to the launch catalog
--    (free: 100 cards, 25 scans/mo, 0 AI grade checks, 0 alerts, 30d history).
update entitlements set plan = 'collector' where plan = 'collector_pro';

alter table entitlements alter column collection_limit          set default 100;
alter table entitlements alter column quick_scan_monthly_limit  set default 25;
alter table entitlements alter column grade_scan_monthly_limit  set default 0;
alter table entitlements alter column alerts_limit              set default 5;
alter table entitlements alter column history_days              set default 30;

update entitlements
   set quick_scan_monthly_limit = 25,
       grade_scan_monthly_limit = 0
 where plan = 'free';

-- 3. Race-safe monthly usage metering. Periods are UTC calendar months.
--    consume_usage RESERVES one unit atomically: the conditional UPDATE is a
--    single statement, so two concurrent requests can never both pass a
--    limit-1 check (one of them sees the incremented row). release_usage
--    refunds a reservation when the metered operation failed.

create or replace function usage_period_start(at timestamptz default now())
returns timestamptz
language sql immutable as
$$ select date_trunc('month', at at time zone 'utc') at time zone 'utc' $$;

create or replace function current_usage(p_user_id uuid)
returns table (quick_scans_used integer, grade_scans_used integer)
language sql stable as
$$
  select coalesce(u.quick_scans_used, 0), coalesce(u.grade_scans_used, 0)
    from (select 1) one
    left join usage_periods u
      on u.user_id = p_user_id and u.period_start = usage_period_start()
$$;

create or replace function consume_usage(p_user_id uuid, p_metric text, p_limit integer)
returns table (allowed boolean, current_count integer)
language plpgsql as
$$
declare
  v_start timestamptz := usage_period_start();
  v_end   timestamptz := (v_start + interval '1 month');
  v_count integer;
begin
  if p_metric not in ('quick_scan', 'grade_scan') then
    raise exception 'unknown usage metric: %', p_metric;
  end if;

  -- Ensure the current-month row exists (idempotent under concurrency).
  insert into usage_periods (user_id, period_start, period_end)
  values (p_user_id, v_start, v_end)
  on conflict (user_id, period_start) do nothing;

  -- Atomic conditional increment: succeeds only while under the limit
  -- (p_limit < 0 means unlimited).
  if p_metric = 'quick_scan' then
    update usage_periods u
       set quick_scans_used = u.quick_scans_used + 1
     where u.user_id = p_user_id and u.period_start = v_start
       and (p_limit < 0 or u.quick_scans_used < p_limit)
    returning u.quick_scans_used into v_count;
  else
    update usage_periods u
       set grade_scans_used = u.grade_scans_used + 1
     where u.user_id = p_user_id and u.period_start = v_start
       and (p_limit < 0 or u.grade_scans_used < p_limit)
    returning u.grade_scans_used into v_count;
  end if;

  if v_count is not null then
    return query select true, v_count;
    return;
  end if;

  -- At/over the limit: report the current count without consuming.
  select case when p_metric = 'quick_scan' then u.quick_scans_used else u.grade_scans_used end
    into v_count
    from usage_periods u
   where u.user_id = p_user_id and u.period_start = v_start;
  return query select false, coalesce(v_count, 0);
end;
$$;

create or replace function release_usage(p_user_id uuid, p_metric text)
returns void
language plpgsql as
$$
declare
  v_start timestamptz := usage_period_start();
begin
  if p_metric = 'quick_scan' then
    update usage_periods u
       set quick_scans_used = greatest(0, u.quick_scans_used - 1)
     where u.user_id = p_user_id and u.period_start = v_start;
  elsif p_metric = 'grade_scan' then
    update usage_periods u
       set grade_scans_used = greatest(0, u.grade_scans_used - 1)
     where u.user_id = p_user_id and u.period_start = v_start;
  end if;
end;
$$;

comment on function consume_usage is
  'Atomically reserve one unit of a monthly usage metric; refund failed operations with release_usage.';
