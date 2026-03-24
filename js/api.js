/**
 * GeoLearn Japan — API Module (api.js)
 * ══════════════════════════════════════════════════
 * All Supabase database queries live here.
 * Premium status is ALWAYS fetched from Supabase — never from localStorage.
 *
 * Supabase project: ftmkgkxzgobgjkasnmxn
 *
 * Tables used:
 *   - subscriptions  (id, user_id, plan, created_at)
 *   - user_progress  (id, user_id, progress_data, updated_at)
 *   - analytics_events (id, user_id, event_name, event_data, created_at)
 *
 * Copyright (c) 2026 MYO NAING TUN / MYO_Geo_Orgs. All Rights Reserved.
 */
'use strict';

// ── Supabase Config ─────────────────────────────────────────
// Anon key is intentionally public — Supabase RLS enforces access control.
var SUPABASE_URL      = 'https://ftmkgkxzgobgjkasnmxn.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0bWtna3h6Z29iZ2prYXNubXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMzk5MDQsImV4cCI6MjA4NjYxNTkwNH0.aux0UErkO2zBsDYfiJvAGFR8RokLKbs_Sr1cGHhMRms';

// ── Get Supabase client ─────────────────────────────────────
// Re-uses the client created in index.html if available.
function getClient() {
  if (window._geoSupaClient) return window._geoSupaClient;
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    window._geoSupaClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return window._geoSupaClient || null;
}

// ── fetchSubscriptionPlan ───────────────────────────────────
/**
 * Fetch the user's subscription plan from Supabase.
 *
 * Security:
 *  - Row Level Security on `subscriptions` table ensures each user
 *    can only read their own row (auth.uid() = user_id).
 *  - Never falls back to localStorage — server is source of truth.
 *
 * @param {string} userId - Supabase auth user UUID
 * @returns {Promise<'free'|'premium'>}
 */
async function fetchSubscriptionPlan(userId) {
  var client = getClient();
  if (!client || !userId) return 'free';

  try {
    var result = await client
      .from('subscriptions')
      .select('plan')
      .eq('user_id', userId)
      .single();

    var data = result.data;
    var err  = result.error;

    // PGRST116 = no rows found → treat as free
    if (err && err.code !== 'PGRST116') {
      console.warn('[GeoAPI] Subscription fetch error:', err.message);
      return 'free';
    }

    return (data && data.plan === 'premium') ? 'premium' : 'free';
  } catch (e) {
    console.warn('[GeoAPI] Subscription fetch exception:', e);
    return 'free';
  }
}

// ── fetchUserProgress ───────────────────────────────────────
/**
 * Fetch progress data from Supabase for the authenticated user.
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function fetchUserProgress(userId) {
  var client = getClient();
  if (!client || !userId) return null;
  try {
    var result = await client
      .from('user_progress')
      .select('progress_data')
      .eq('user_id', userId)
      .single();
    if (result.error && result.error.code !== 'PGRST116') throw result.error;
    return result.data ? result.data.progress_data : null;
  } catch (e) {
    console.warn('[GeoAPI] Progress fetch failed:', e);
    return null;
  }
}

// ── upsertUserProgress ──────────────────────────────────────
/**
 * Save progress data to Supabase.
 * @param {string} userId
 * @param {Object} progressData
 * @returns {Promise<boolean>} success
 */
async function upsertUserProgress(userId, progressData) {
  var client = getClient();
  if (!client || !userId) return false;
  try {
    var result = await client
      .from('user_progress')
      .upsert({ user_id: userId, progress_data: progressData, updated_at: new Date().toISOString() },
               { onConflict: 'user_id' });
    if (result.error) throw result.error;
    return true;
  } catch (e) {
    console.warn('[GeoAPI] Progress save failed:', e);
    return false;
  }
}

// ── logAnalyticsEvent ───────────────────────────────────────
/**
 * Log an analytics event to Supabase.
 * @param {string|null} userId
 * @param {string} eventName
 * @param {Object} [eventData]
 */
async function logAnalyticsEvent(userId, eventName, eventData) {
  var client = getClient();
  if (!client) return;
  try {
    await client.from('analytics_events').insert({
      user_id: userId || null,
      event_name: eventName,
      event_data: eventData || {},
      created_at: new Date().toISOString()
    });
  } catch (e) {
    // Analytics failures are non-critical
  }
}

// ── Exports ─────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fetchSubscriptionPlan, fetchUserProgress, upsertUserProgress, logAnalyticsEvent };
} else {
  window.GeoAPI = { fetchSubscriptionPlan, fetchUserProgress, upsertUserProgress, logAnalyticsEvent };
}
