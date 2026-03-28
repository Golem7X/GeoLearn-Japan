-- ============================================================
-- GeoLearn Japan — payment_requests table
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_requests (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  method       text NOT NULL CHECK (method IN ('paynow', 'uob', 'kbzpay')),
  buyer_email  text NOT NULL,
  txn_ref      text,                  -- transaction reference / ID
  amount       text,                  -- e.g. 'SGD 7' or '10,000 MMK'
  status       text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  license_key  text,                  -- filled after approval
  created_at   timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Index for fast status lookups
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_txn    ON payment_requests(txn_ref);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (even unauthenticated) can submit a payment request
CREATE POLICY "allow_anon_insert"
  ON payment_requests FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated users can also insert
CREATE POLICY "allow_auth_insert"
  ON payment_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No SELECT/UPDATE/DELETE from frontend — only via service role (Edge Functions)
