-- 0012_indexes_perf.sql
-- Purpose: remaining performance indexes (FKs, common filters, search, partial indexes).
-- ROLLBACK: drop index <each index below>;

-- Foreign-key / hot-filter coverage not already created inline.
create index if not exists idx_subscriptions_status on subscriptions(status);
-- Partial index: the billing reconciler scans only live subscriptions.
create index if not exists idx_subscriptions_active on subscriptions(user_id)
  where status in ('trialing','active','past_due');

create index if not exists idx_collection_items_ownership on collection_items(user_id, ownership_type);

-- Grade report share-link lookups.
create index if not exists idx_grade_reports_share_token on grade_reports(share_token)
  where share_token is not null;

-- Watchlist variant coverage.
create index if not exists idx_watchlist_items_variant on watchlist_items(card_variant_id);

-- API key active lookups (unrevoked).
create index if not exists idx_api_keys_active on api_keys(prefix) where revoked_at is null;

-- Trigram search over set names for the catalog browser.
create index if not exists idx_sets_name_trgm on sets using gin (name gin_trgm_ops);

-- Background job dequeue: ready-to-run queued jobs.
create index if not exists idx_background_jobs_ready on background_jobs(run_after)
  where status = 'queued';

-- Notifications feed ordering already covered; add type filter for digests.
create index if not exists idx_notifications_type on notifications(user_id, type);

-- External id reverse lookup by provider.
create index if not exists idx_external_id_mappings_provider on external_id_mappings(provider, entity_type);
