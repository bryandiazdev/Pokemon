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
