-- ============================================================
-- GeoLearn Japan — Supabase Database Schema
-- Freemium system: Anonymous Auth + License Keys + Progress
-- ============================================================
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── 1. SUBSCRIPTIONS TABLE ──────────────────────────────────
-- Tracks each user's current plan ('free' | 'premium')
CREATE TABLE IF NOT EXISTS subscriptions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan          text DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  license_key   text,
  activated_at  timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── 2. USER PROGRESS TABLE ──────────────────────────────────
-- Stores serialised localStorage progress as JSONB for cross-device sync
CREATE TABLE IF NOT EXISTS user_progress (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  progress_data jsonb DEFAULT '{}'::jsonb,
  updated_at    timestamptz DEFAULT now()
);

-- ── 3. ANALYTICS EVENTS TABLE ───────────────────────────────
-- Lightweight event log (page views, quiz completions, etc.)
CREATE TABLE IF NOT EXISTS analytics_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name  text NOT NULL,
  event_data  jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);

-- ── 4. LICENSE KEYS TABLE ───────────────────────────────────
-- Stores all issued license keys. Only readable via Edge Function (service role).
CREATE TABLE IF NOT EXISTS license_keys (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key          text UNIQUE NOT NULL,
  max_devices  integer DEFAULT 2,
  used_devices integer DEFAULT 0,
  is_active    boolean DEFAULT true,
  expires_at   timestamptz,         -- NULL = never expires
  note         text,                -- optional: batch/customer note
  created_at   timestamptz DEFAULT now()
);

-- ── 5. LICENSE ACTIVATIONS TABLE ────────────────────────────
-- One row per (license, user) pair. Tracks which device activated it.
CREATE TABLE IF NOT EXISTS license_activations (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  license_id         uuid REFERENCES license_keys(id) ON DELETE CASCADE NOT NULL,
  user_id            uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_fingerprint text NOT NULL DEFAULT 'unknown',
  activated_at       timestamptz DEFAULT now(),
  UNIQUE(license_id, user_id)
);

-- ── 6. LICENSE ATTEMPTS TABLE (rate limiting) ────────────────
-- Logs every validation attempt so the Edge Function can rate-limit
CREATE TABLE IF NOT EXISTS license_attempts (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  key_prefix  text,        -- first 4 chars only (no full key stored)
  created_at  timestamptz DEFAULT now()
);

-- Auto-purge attempts older than 1 hour (keep table small)
-- Supabase pg_cron: SELECT cron.schedule('purge-license-attempts', '0 * * * *',
--   $$DELETE FROM license_attempts WHERE created_at < now() - interval '1 hour'$$);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress      ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_keys       ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_attempts   ENABLE ROW LEVEL SECURITY;

-- ── subscriptions: users read/write only their own row ───────
CREATE POLICY "sub_select_own"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "sub_insert_own"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sub_update_own"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── user_progress: full CRUD for own row ────────────────────
CREATE POLICY "progress_all_own"
  ON user_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── analytics_events: insert own events only ────────────────
CREATE POLICY "analytics_insert_own"
  ON analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ── license_keys: NO frontend access (Edge Function only) ───
-- Service role key used in Edge Function bypasses RLS entirely.
-- No user-facing policies → anonymous & authenticated users cannot read keys.

-- ── license_activations: NO frontend access ─────────────────
-- Managed exclusively via Edge Function (service role).

-- ── license_attempts: insert own only ───────────────────────
CREATE POLICY "attempts_insert_own"
  ON license_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- INDEXES for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id     ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id     ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id         ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_name      ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_license_keys_key          ON license_keys(key);
CREATE INDEX IF NOT EXISTS idx_license_activations_lic   ON license_activations(license_id);
CREATE INDEX IF NOT EXISTS idx_license_activations_user  ON license_activations(user_id);
CREATE INDEX IF NOT EXISTS idx_license_attempts_user     ON license_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_license_attempts_created  ON license_attempts(created_at);

-- ============================================================
-- HELPER FUNCTION: auto-update updated_at timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER user_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
