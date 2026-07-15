-- 0006_collections.sql
-- Purpose: user collections, items, user tags, and the item<->tag join.
-- ROLLBACK: drop table collection_item_tags, user_tags, collection_items, collections;

create table if not exists collections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  description text,
  is_default  boolean     not null default false,
  visibility  collection_visibility not null default 'private',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_collections_user_id on collections(user_id);
-- At most one default collection per user.
create unique index if not exists uq_collections_default_per_user
  on collections(user_id) where is_default;

drop trigger if exists trg_collections_updated_at on collections;
create trigger trg_collections_updated_at
  before update on collections for each row execute function set_updated_at();

-- All money columns are INTEGER minor units (e.g. cents). No floats for money.
create table if not exists collection_items (
  id                    uuid primary key default gen_random_uuid(),
  collection_id         uuid        not null references collections(id) on delete cascade,
  user_id               uuid        not null references auth.users(id) on delete cascade, -- denormalized for RLS
  card_id               uuid        not null references cards(id) on delete restrict,
  card_variant_id       uuid        references card_variants(id) on delete set null,
  quantity              integer     not null default 1,
  ownership_type        ownership_type not null default 'raw',
  raw_condition         raw_condition,
  grading_company       grading_company,
  grade                 numeric(4,1),
  grade_label           text,
  certification_number  text,
  purchase_price_minor  integer,
  purchase_currency     char(3)     not null default 'USD',
  purchase_date         date,
  acquisition_source    text,
  notes                 text,
  front_image_path      text,
  back_image_path       text,
  estimated_value_minor integer,
  valuation_price_point_id uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint chk_collection_items_quantity check (quantity > 0),
  constraint chk_collection_items_prices_nonneg check (
    (purchase_price_minor is null or purchase_price_minor >= 0) and
    (estimated_value_minor is null or estimated_value_minor >= 0)
  )
);

create index if not exists idx_collection_items_user_id on collection_items(user_id);
create index if not exists idx_collection_items_collection_id on collection_items(collection_id);
create index if not exists idx_collection_items_card_id on collection_items(card_id);
create index if not exists idx_collection_items_variant_id on collection_items(card_variant_id);

drop trigger if exists trg_collection_items_updated_at on collection_items;
create trigger trg_collection_items_updated_at
  before update on collection_items for each row execute function set_updated_at();

create table if not exists user_tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  color      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists idx_user_tags_user_id on user_tags(user_id);

drop trigger if exists trg_user_tags_updated_at on user_tags;
create trigger trg_user_tags_updated_at
  before update on user_tags for each row execute function set_updated_at();

-- Join table. Carries a denormalized user_id so RLS is a simple equality check.
create table if not exists collection_item_tags (
  collection_item_id uuid        not null references collection_items(id) on delete cascade,
  user_tag_id        uuid        not null references user_tags(id) on delete cascade,
  user_id            uuid        not null references auth.users(id) on delete cascade, -- denormalized for RLS
  created_at         timestamptz not null default now(),
  primary key (collection_item_id, user_tag_id)
);

create index if not exists idx_collection_item_tags_user_id on collection_item_tags(user_id);
create index if not exists idx_collection_item_tags_tag on collection_item_tags(user_tag_id);
