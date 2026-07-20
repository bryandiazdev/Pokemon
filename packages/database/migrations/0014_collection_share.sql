-- 0014_collection_share.sql
-- Purpose: shareable read-only collection links. Sharing sets visibility to
-- 'unlisted' and mints an unguessable slug; disabling clears the slug so old
-- links die permanently (re-enabling mints a fresh link).
-- ROLLBACK: alter table collections drop column share_slug;

alter table collections add column if not exists share_slug text;

create unique index if not exists uq_collections_share_slug
  on collections(share_slug) where share_slug is not null;
