-- 0013_billing_enums.sql
-- Purpose: new plan tiers, in their own migration file.
--
-- Postgres forbids USING a new enum value in the transaction that added it,
-- and SQL runners like the Supabase Dashboard editor wrap a whole script in
-- one transaction. Keeping the ADD VALUE statements in a separate file (which
-- sorts before 0013_billing_v2.sql) guarantees they are committed before any
-- statement references them, on every runner.
-- ROLLBACK: enum values cannot be removed without a type rebuild.

alter type plan_tier add value if not exists 'collector';
alter type plan_tier add value if not exists 'pro';
