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
