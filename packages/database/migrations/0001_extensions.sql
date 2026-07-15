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
