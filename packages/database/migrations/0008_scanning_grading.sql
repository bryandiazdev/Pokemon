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
