-- ============================================================
-- GeoLearn Japan — update payment_requests method constraint
-- Replaces PayPal with Singapore bank methods (PayNow, UOB)
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

ALTER TABLE payment_requests
  DROP CONSTRAINT IF EXISTS payment_requests_method_check;

ALTER TABLE payment_requests
  ADD CONSTRAINT payment_requests_method_check
  CHECK (method IN ('paynow', 'uob', 'kbzpay'));
