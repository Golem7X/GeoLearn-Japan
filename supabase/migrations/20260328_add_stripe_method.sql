-- ============================================================
-- GeoLearn Japan — add 'stripe' to payment method constraint
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

ALTER TABLE payment_requests
  DROP CONSTRAINT IF EXISTS payment_requests_method_check;

ALTER TABLE payment_requests
  ADD CONSTRAINT payment_requests_method_check
  CHECK (method IN ('paynow', 'uob', 'kbzpay', 'stripe'));
