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
