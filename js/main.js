/**
 * GeoLearn Japan — App Initialization (main.js)
 * ══════════════════════════════════════════════════
 * Entry point for the Supabase Auth Upgrade v2.
 * Orchestrates: session check → subscription fetch → UI update.
 *
 * Flow:
 *  1. DOM loaded → show loading overlay (prevents premium content flash)
 *  2. Check Supabase session (persisted from last visit)
 *  3. If signed in  → fetch subscription plan from `subscriptions` table
 *  4. If signed out → treat as 'free'
 *  5. Override isPremium() to use server-fetched plan
 *  6. Apply plan to UI (body classes, nav locks, user badge)
 *  7. Hide loading overlay
 *
 * Security:
 *  - Plan is stored in a module-level variable (_plan) — NOT localStorage
 *  - Fresh Supabase query on every page load
 *  - Loading overlay prevents any premium content from showing before verification
 *
 * Requires:
 *  - window._geoSupaClient (set in index.html)
 *  - GeoAPI.fetchSubscriptionPlan
 *  - GeoUI.* methods
 *
 * Copyright (c) 2026 MYO NAING TUN / MYO_Geo_Orgs. All Rights Reserved.
 */
'use strict';

// ── Module-level plan cache ──────────────────────────────────
// NOT in localStorage. Resets on every page load.
// Populated only after Supabase verifies the user's plan.
var _plan = null; // null = pending verification

// ── isPremium override ───────────────────────────────────────
// Wraps the existing localStorage-based isPremium() and overrides
// it with the server-fetched plan once available.
(function _patchIsPremium() {
  var _orig = window.isPremium;
  window.isPremium = function () {
    // Admin preview always takes priority
    try {
      if (window.isAdmin && window.isAdmin()) {
        var p = sessionStorage.getItem('GeoLearn_Admin_Preview');
        if (p === 'premium') return true;
        if (p === 'free')    return false;
      }
    } catch (e) {}

    // Server-fetched plan takes priority over localStorage
    if (_plan !== null) return _plan === 'premium';

    // Fallback while loading (localStorage — only used briefly during init)
    return _orig ? _orig() : false;
  };
})();

// ── initAppAuth ──────────────────────────────────────────────
/**
 * Main initialization function.
 * Called on DOMContentLoaded.
 */
async function initAppAuth() {
  var client = window._geoSupaClient;

  // No Supabase client (CDN failed?) — degrade gracefully
  if (!client) {
    _plan = 'free';
    if (typeof window.initPremiumSystem === 'function') window.initPremiumSystem();
    if (window.GeoUI) window.GeoUI.hideLoadingOverlay();
    return;
  }

  try {
    // Step 1: Restore persisted session
    var resp    = await client.auth.getSession();
    var session = resp.data && resp.data.session;

    if (session && session.user) {
      // Step 2: Fetch subscription plan from Supabase (never localStorage)
      _plan = await (window.GeoAPI
        ? window.GeoAPI.fetchSubscriptionPlan(session.user.id)
        : _fallbackFetchPlan(client, session.user.id));

      // Step 3: Update user badge
      if (window.GeoUI) window.GeoUI.updateUserPlanBadge(_plan, true);
    } else {
      // Not signed in → free tier
      _plan = 'free';
      if (window.GeoUI) window.GeoUI.updateUserPlanBadge('free', false);
    }
  } catch (err) {
    console.warn('[GeoMain] Init error:', err);
    _plan = 'free';
  }

  // Step 4: Apply verified plan to the premium system (body classes, nav locks, etc.)
  if (typeof window.initPremiumSystem === 'function') {
    window.initPremiumSystem();
  }

  // Step 5: Reveal the app (loading overlay fades out)
  if (window.GeoUI) window.GeoUI.hideLoadingOverlay();
}

// ── Inline fallback (when GeoAPI module not loaded) ──────────
async function _fallbackFetchPlan(client, userId) {
  try {
    var result = await client
      .from('subscriptions')
      .select('plan')
      .eq('user_id', userId)
      .single();
    var data = result.data, err = result.error;
    if (err && err.code !== 'PGRST116') return 'free';
    return (data && data.plan === 'premium') ? 'premium' : 'free';
  } catch (e) { return 'free'; }
}

// ── Auth state listener ──────────────────────────────────────
// Responds to sign-in, sign-out, and token refresh events.
(function _setupAuthListener() {
  var client = window._geoSupaClient;
  if (!client) return;

  client.auth.onAuthStateChange(async function (event, session) {
    if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && session.user) {
      _plan = await _fallbackFetchPlan(client, session.user.id);
      if (window.GeoUI) window.GeoUI.updateUserPlanBadge(_plan, true);
      if (typeof window.initPremiumSystem === 'function') window.initPremiumSystem();
    } else if (event === 'SIGNED_OUT') {
      _plan = 'free';
      if (window.GeoUI) window.GeoUI.updateUserPlanBadge('free', false);
      if (typeof window.initPremiumSystem === 'function') window.initPremiumSystem();
    }
  });
})();

// ── DOMContentLoaded ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initAppAuth);

// ── Expose for external use ──────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initAppAuth };
} else {
  window.GeoMain = { initAppAuth };
}
