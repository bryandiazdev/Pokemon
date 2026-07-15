-- seed/demo.sql
-- CLEARLY-LABELED DEMO DATA. Every row carries metadata->>'demo' = 'true'.
-- This is NOT live market data; values are illustrative fixtures for local dev / charts.
-- Idempotent: uses fixed UUIDs + ON CONFLICT DO NOTHING. Safe to run repeatedly.
-- Does NOT touch auth.users (Supabase auth owns that).

begin;

-- ---------------------------------------------------------------------------
-- SETS
-- ---------------------------------------------------------------------------
insert into sets (id, name, series, language, printed_total, total, release_date, canonical_slug, metadata)
values
  ('5e700001-0000-4000-8000-000000000001', 'Base Set', 'Original', 'en', 102, 102, '1999-01-09', 'demo-base-set-1999-en',
   '{"demo": true}'::jsonb),
  ('5e700001-0000-4000-8000-000000000002', 'Paldean Fates', 'Scarlet & Violet', 'en', 245, 245, '2024-01-26', 'demo-paldean-fates-2024-en',
   '{"demo": true}'::jsonb),
  ('5e700001-0000-4000-8000-000000000003', 'Pokémon Card 151 (SV2a)', 'Scarlet & Violet', 'ja', 165, 165, '2023-06-16', 'demo-sv2a-151-2023-ja',
   '{"demo": true}'::jsonb),
  ('5e700001-0000-4000-8000-000000000004', 'SWSH Black Star Promos', 'Sword & Shield', 'en', null, null, '2019-11-15', 'demo-swsh-promos-en',
   '{"demo": true}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- CARDS
-- ---------------------------------------------------------------------------
insert into cards (id, set_id, name, number, printed_number, rarity, supertype, subtypes, language, artist, canonical_slug, metadata)
values
  -- Vintage chase: Base Set Charizard (huge raw vs PSA10 gap)
  ('ca5d0001-0000-4000-8000-000000000001', '5e700001-0000-4000-8000-000000000001', 'Charizard', '4', '4/102', 'Rare Holo',
   'Pokémon', array['Stage 2'], 'en', 'Mitsuhiro Arita', 'demo-base-charizard-4-102', '{"demo": true}'::jsonb),
  -- Vintage Pikachu
  ('ca5d0001-0000-4000-8000-000000000002', '5e700001-0000-4000-8000-000000000001', 'Pikachu', '58', '58/102', 'Common',
   'Pokémon', array['Basic'], 'en', 'Atsuko Nishida', 'demo-base-pikachu-58-102', '{"demo": true}'::jsonb),
  -- Modern Mew ex alt art
  ('ca5d0001-0000-4000-8000-000000000003', '5e700001-0000-4000-8000-000000000002', 'Mew ex', '232', '232/091', 'Special Illustration Rare',
   'Pokémon', array['Basic','ex'], 'en', 'Saki Hayashiro', 'demo-paldean-fates-mew-ex-232', '{"demo": true}'::jsonb),
  -- Japanese 151 Charizard
  ('ca5d0001-0000-4000-8000-000000000004', '5e700001-0000-4000-8000-000000000003', 'リザードン (Charizard) ex', '185', '185/165', 'SAR',
   'Pokémon', array['Stage 2','ex'], 'ja', 'PLANeT', 'demo-sv2a-charizard-ex-185', '{"demo": true}'::jsonb),
  -- Promo Pikachu
  ('ca5d0001-0000-4000-8000-000000000005', '5e700001-0000-4000-8000-000000000004', 'Pikachu V', 'SWSH061', 'SWSH061', 'Promo',
   'Pokémon', array['Basic','V'], 'en', 'aky CG Works', 'demo-swsh-promo-pikachu-v', '{"demo": true}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- CARD VARIANTS (incl. reverse holo)
-- ---------------------------------------------------------------------------
insert into card_variants (id, card_id, finish, edition, language, variant_name, metadata)
values
  ('7a710001-0000-4000-8000-000000000001', 'ca5d0001-0000-4000-8000-000000000001', 'first_edition', '1st Edition', 'en', 'Base Set 1st Edition', '{"demo": true}'::jsonb),
  ('7a710001-0000-4000-8000-000000000002', 'ca5d0001-0000-4000-8000-000000000001', 'unlimited', 'Unlimited', 'en', 'Base Set Unlimited', '{"demo": true}'::jsonb),
  ('7a710001-0000-4000-8000-000000000003', 'ca5d0001-0000-4000-8000-000000000002', 'reverse_holo', 'Unlimited', 'en', 'Reverse Holo', '{"demo": true}'::jsonb),
  ('7a710001-0000-4000-8000-000000000004', 'ca5d0001-0000-4000-8000-000000000003', 'holo', null, 'en', 'Alt Art Holo', '{"demo": true}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- EXTERNAL ID MAPPINGS (demo)
-- ---------------------------------------------------------------------------
insert into external_id_mappings (id, entity_type, internal_id, provider, external_id, external_url, metadata)
values
  ('e8710001-0000-4000-8000-000000000001', 'card', 'ca5d0001-0000-4000-8000-000000000001', 'pokemontcg', 'base1-4',
   'https://example.invalid/base1-4', '{"demo": true}'::jsonb),
  ('e8710001-0000-4000-8000-000000000002', 'card', 'ca5d0001-0000-4000-8000-000000000003', 'pokemontcg', 'sv4pt5-232',
   'https://example.invalid/sv4pt5-232', '{"demo": true}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- CURRENCY RATE (demo)
-- ---------------------------------------------------------------------------
insert into currency_rates (id, base, quote, rate, as_of)
values ('c0710001-0000-4000-8000-000000000001', 'USD', 'EUR', 0.92000000, current_date)
on conflict (base, quote, as_of) do nothing;

-- ---------------------------------------------------------------------------
-- PRICE POINTS: 30 days of daily history so charts render.
-- Helper series `d` maps a day-offset (0..29) to a date and a deterministic wobble.
-- value_minor = base + trend*offset + small deterministic noise (all integer, USD cents).
-- ---------------------------------------------------------------------------

-- Charizard raw Near Mint (unlimited variant): base ~ $350
insert into price_points
  (card_id, card_variant_id, provider, market, currency, condition, grading_company, grade,
   value_minor, low_value_minor, high_value_minor, sample_size, valuation_type, recorded_for_date)
select
  'ca5d0001-0000-4000-8000-000000000001', '7a710001-0000-4000-8000-000000000002',
  'demo', 'ebay', 'USD', 'near_mint'::raw_condition, null, null,
  35000 + n*120 + ((n*37) % 400),
  32000 + n*120, 39000 + n*120, 12, 'market'::valuation_type,
  current_date - (29 - n)
from generate_series(0, 29) as n
on conflict do nothing;

-- Charizard PSA 9 (unlimited): base ~ $1,800
insert into price_points
  (card_id, card_variant_id, provider, market, currency, condition, grading_company, grade,
   value_minor, low_value_minor, high_value_minor, sample_size, valuation_type, recorded_for_date)
select
  'ca5d0001-0000-4000-8000-000000000001', '7a710001-0000-4000-8000-000000000002',
  'demo', 'ebay', 'USD', null, 'psa'::grading_company, 9.0,
  180000 + n*450 + ((n*53) % 1500),
  170000 + n*450, 195000 + n*450, 8, 'market'::valuation_type,
  current_date - (29 - n)
from generate_series(0, 29) as n
on conflict do nothing;

-- Charizard PSA 10 (unlimited): base ~ $12,000 (the big gap)
insert into price_points
  (card_id, card_variant_id, provider, market, currency, condition, grading_company, grade,
   value_minor, low_value_minor, high_value_minor, sample_size, valuation_type, recorded_for_date)
select
  'ca5d0001-0000-4000-8000-000000000001', '7a710001-0000-4000-8000-000000000002',
  'demo', 'ebay', 'USD', null, 'psa'::grading_company, 10.0,
  1200000 + n*3500 + ((n*97) % 9000),
  1150000 + n*3500, 1300000 + n*3500, 4, 'market'::valuation_type,
  current_date - (29 - n)
from generate_series(0, 29) as n
on conflict do nothing;

-- Charizard PSA 8 (unlimited): base ~ $900
insert into price_points
  (card_id, card_variant_id, provider, market, currency, condition, grading_company, grade,
   value_minor, low_value_minor, high_value_minor, sample_size, valuation_type, recorded_for_date)
select
  'ca5d0001-0000-4000-8000-000000000001', '7a710001-0000-4000-8000-000000000002',
  'demo', 'ebay', 'USD', null, 'psa'::grading_company, 8.0,
  90000 + n*200 + ((n*29) % 800), 85000 + n*200, 98000 + n*200, 10, 'market'::valuation_type,
  current_date - (29 - n)
from generate_series(0, 29) as n
on conflict do nothing;

-- Charizard BGS 9.5 (unlimited)
insert into price_points
  (card_id, card_variant_id, provider, market, currency, condition, grading_company, grade,
   value_minor, low_value_minor, high_value_minor, sample_size, valuation_type, recorded_for_date)
select
  'ca5d0001-0000-4000-8000-000000000001', '7a710001-0000-4000-8000-000000000002',
  'demo', 'ebay', 'USD', null, 'bgs'::grading_company, 9.5,
  350000 + n*900 + ((n*61) % 2500), 330000 + n*900, 380000 + n*900, 3, 'market'::valuation_type,
  current_date - (29 - n)
from generate_series(0, 29) as n
on conflict do nothing;

-- Pikachu reverse holo raw NM: base ~ $6
insert into price_points
  (card_id, card_variant_id, provider, market, currency, condition, grading_company, grade,
   value_minor, low_value_minor, high_value_minor, sample_size, valuation_type, recorded_for_date)
select
  'ca5d0001-0000-4000-8000-000000000002', '7a710001-0000-4000-8000-000000000003',
  'demo', 'tcgplayer', 'USD', 'near_mint'::raw_condition, null, null,
  600 + n*3 + ((n*7) % 40), 500 + n*3, 750 + n*3, 40, 'market'::valuation_type,
  current_date - (29 - n)
from generate_series(0, 29) as n
on conflict do nothing;

-- Mew ex alt art raw NM: base ~ $70
insert into price_points
  (card_id, card_variant_id, provider, market, currency, condition, grading_company, grade,
   value_minor, low_value_minor, high_value_minor, sample_size, valuation_type, recorded_for_date)
select
  'ca5d0001-0000-4000-8000-000000000003', '7a710001-0000-4000-8000-000000000004',
  'demo', 'tcgplayer', 'USD', 'near_mint'::raw_condition, null, null,
  7000 + n*40 + ((n*13) % 300), 6500 + n*40, 7800 + n*40, 25, 'market'::valuation_type,
  current_date - (29 - n)
from generate_series(0, 29) as n
on conflict do nothing;

-- Mew ex alt art CGC 10: base ~ $260
insert into price_points
  (card_id, card_variant_id, provider, market, currency, condition, grading_company, grade,
   value_minor, low_value_minor, high_value_minor, sample_size, valuation_type, recorded_for_date)
select
  'ca5d0001-0000-4000-8000-000000000003', '7a710001-0000-4000-8000-000000000004',
  'demo', 'ebay', 'USD', null, 'cgc'::grading_company, 10.0,
  26000 + n*120 + ((n*17) % 900), 24000 + n*120, 28000 + n*120, 6, 'market'::valuation_type,
  current_date - (29 - n)
from generate_series(0, 29) as n
on conflict do nothing;

-- Japanese 151 Charizard ex SAR raw NM: base ~ $110
insert into price_points
  (card_id, card_variant_id, provider, market, currency, condition, grading_company, grade,
   value_minor, low_value_minor, high_value_minor, sample_size, valuation_type, recorded_for_date)
select
  'ca5d0001-0000-4000-8000-000000000004', null,
  'demo', 'cardrush', 'JPY', 'near_mint'::raw_condition, null, null,
  16000 + n*80 + ((n*23) % 500), 15000 + n*80, 17000 + n*80, 15, 'market'::valuation_type,
  current_date - (29 - n)
from generate_series(0, 29) as n
on conflict do nothing;

-- Promo Pikachu V raw NM: base ~ $12
insert into price_points
  (card_id, card_variant_id, provider, market, currency, condition, grading_company, grade,
   value_minor, low_value_minor, high_value_minor, sample_size, valuation_type, recorded_for_date)
select
  'ca5d0001-0000-4000-8000-000000000005', null,
  'demo', 'tcgplayer', 'USD', 'near_mint'::raw_condition, null, null,
  1200 + n*5 + ((n*11) % 60), 1000 + n*5, 1400 + n*5, 30, 'market'::valuation_type,
  current_date - (29 - n)
from generate_series(0, 29) as n
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- FEATURE FLAGS (demo)
-- ---------------------------------------------------------------------------
insert into feature_flags (key, enabled, rollout, payload)
values
  ('demo_mode', true, 1.0, '{"demo": true}'::jsonb),
  ('grade_scan_beta', false, 0.10, '{"demo": true}'::jsonb)
on conflict (key) do nothing;

commit;
