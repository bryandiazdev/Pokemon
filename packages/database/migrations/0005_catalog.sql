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
