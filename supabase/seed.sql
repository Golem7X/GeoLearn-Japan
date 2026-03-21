-- ============================================================
-- GeoLearn Japan — Seed: Sample License Keys
-- Run in Supabase SQL Editor AFTER schema.sql
--
-- Format: GEOLEARN-XXXX-XXXX-XXXX
-- These are test/demo keys. Replace with real generated keys
-- before going to production.
-- Use supabase/functions/_shared/keygen approach or your own
-- key generation system to produce keys at scale.
-- ============================================================

INSERT INTO license_keys (key, max_devices, is_active, note)
VALUES
  -- Single-device lifetime keys (personal)
  ('GEOLEARN-2026-BETA-0001', 1, true, 'Beta tester — single device'),
  ('GEOLEARN-2026-BETA-0002', 1, true, 'Beta tester — single device'),
  ('GEOLEARN-2026-BETA-0003', 1, true, 'Beta tester — single device'),

  -- Two-device keys (standard purchase)
  ('GEOLEARN-2026-STD1-AAA1', 2, true, 'Standard license batch A'),
  ('GEOLEARN-2026-STD1-AAA2', 2, true, 'Standard license batch A'),
  ('GEOLEARN-2026-STD1-AAA3', 2, true, 'Standard license batch A'),
  ('GEOLEARN-2026-STD1-BBB1', 2, true, 'Standard license batch B'),
  ('GEOLEARN-2026-STD1-BBB2', 2, true, 'Standard license batch B'),
  ('GEOLEARN-2026-STD1-BBB3', 2, true, 'Standard license batch B'),

  -- Multi-device team keys (corporate / university)
  ('GEOLEARN-2026-TEAM-TK01', 5, true, 'Team key — university lab 1'),
  ('GEOLEARN-2026-TEAM-TK02', 5, true, 'Team key — university lab 2'),

  -- Promotional / giveaway (single device, expires 2026-12-31)
  ('GEOLEARN-PROMO-FREE-2026', 1, true, 'Promo campaign 2026')
ON CONFLICT (key) DO NOTHING;

-- Update expiry on the promo key
UPDATE license_keys
   SET expires_at = '2026-12-31 23:59:59+00'
 WHERE key = 'GEOLEARN-PROMO-FREE-2026';
