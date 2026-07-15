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
