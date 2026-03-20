/**
 * GeoLearn Japan — UI Module (ui.js)
 * ══════════════════════════════════════════════════
 * Handles all UI state driven by authentication and subscription:
 *   - User plan badge (Free User / Premium User) in header
 *   - Paywall modal for premium-gated content
 *   - Premium content blur/disable for free users
 *   - Loading overlay (prevents content flash before verification)
 *   - Body class toggling (is-premium / is-free)
 *
 * Design: Notion / Duolingo inspired SaaS aesthetic
 * Mobile-first, smooth animations
 *
 * Copyright (c) 2026 MYO NAING TUN / MYO_Geo_Orgs. All Rights Reserved.
 */
'use strict';

// ════════════════════════════════════════════════════
// LOADING OVERLAY
// Shown immediately on page load. Hidden after Supabase
// verifies the user's subscription plan. Prevents the
// premium content from flashing before access is known.
// ════════════════════════════════════════════════════

/**
 * Show the loading overlay.
 */
function showLoadingOverlay() {
  var el = document.getElementById('geo-auth-loading');
  if (!el) return;
  el.style.display = 'flex';
  el.classList.remove('hidden');
}

/**
 * Hide the loading overlay with a fade-out animation.
 */
function hideLoadingOverlay() {
  var el = document.getElementById('geo-auth-loading');
  if (!el) return;
  el.classList.add('hidden');
  setTimeout(function () { el.style.display = 'none'; }, 420);
}

// ════════════════════════════════════════════════════
// USER PLAN BADGE
// Displayed in the top-right header after sign-in.
// Shows plan tier with an Upgrade button for free users.
// ════════════════════════════════════════════════════

/**
 * Update the top-right user plan badge.
 * @param {'free'|'premium'} plan
 * @param {boolean} isLoggedIn
 */
function updateUserPlanBadge(plan, isLoggedIn) {
  var badge      = document.getElementById('user-plan-badge');
  var badgeText  = document.getElementById('user-plan-badge-text');
  var upgradeBtn = document.getElementById('user-plan-upgrade-btn');
  if (!badge) return;

  if (!isLoggedIn) {
    badge.style.display = 'none';
    return;
  }

  badge.style.display = 'flex';

  if (plan === 'premium') {
    badge.className    = 'user-plan-badge premium';
    if (badgeText)  badgeText.textContent  = '\u2B50 Premium User';
    if (upgradeBtn) upgradeBtn.style.display = 'none';
  } else {
    badge.className    = 'user-plan-badge free';
    if (badgeText)  badgeText.textContent  = '\uD83D\uDD13 Free User';
    if (upgradeBtn) upgradeBtn.style.display = 'inline-flex';
  }
}

// ════════════════════════════════════════════════════
// PAYWALL MODAL
// Shown when a free user attempts to access premium
// content. Non-functional upgrade button (Phase 2).
// ════════════════════════════════════════════════════

/**
 * Show the paywall / upgrade modal.
 */
function showPaywallModal() {
  var modal = document.getElementById('upgrade-modal');
  if (modal) modal.classList.add('active');
}

/**
 * Hide the paywall modal.
 */
function hidePaywallModal() {
  var modal = document.getElementById('upgrade-modal');
  if (modal) modal.classList.remove('active');
}

// ════════════════════════════════════════════════════
// PREMIUM CONTENT CONTROL
// Elements with [data-premium="true"] are controlled
// here. For free users: blur + disable. For premium:
// show normally.
// ════════════════════════════════════════════════════

/**
 * Apply blur + disable to all [data-premium="true"] elements for free users.
 */
function blurPremiumContent() {
  var elements = document.querySelectorAll('[data-premium="true"], [data-premium="1"]');
  elements.forEach(function (el) {
    el.classList.add('premium-blurred');
  });
}

/**
 * Remove blur from premium elements (called when user has premium plan).
 */
function unblurPremiumContent() {
  var elements = document.querySelectorAll('[data-premium="true"], [data-premium="1"]');
  elements.forEach(function (el) {
    el.classList.remove('premium-blurred');
  });
}

// ════════════════════════════════════════════════════
// AUTH MODAL HELPERS
// ════════════════════════════════════════════════════

/**
 * Show an error message in the auth modal.
 * @param {string} msg
 */
function showAuthError(msg) {
  var errEl = document.getElementById('auth-error');
  var sucEl = document.getElementById('auth-success');
  if (errEl) { errEl.textContent = msg; errEl.className = 'auth-error show'; }
  if (sucEl) sucEl.className = 'auth-success';
}

/**
 * Show a success message in the auth modal.
 * @param {string} msg
 */
function showAuthSuccess(msg) {
  var sucEl = document.getElementById('auth-success');
  var errEl = document.getElementById('auth-error');
  if (sucEl) { sucEl.textContent = msg; sucEl.className = 'auth-success show'; }
  if (errEl) errEl.className = 'auth-error';
}

/**
 * Update the nav user button and dropdown with current user info.
 * @param {Object|null} user - Supabase user object or null
 */
function updateAuthNavUI(user) {
  var btn      = document.getElementById('nav-user-btn');
  var label    = document.getElementById('nav-user-label');
  var emailEl  = document.getElementById('user-dropdown-email');

  if (user) {
    var initial = (user.email || '?')[0].toUpperCase();
    if (btn)     { btn.textContent = initial; btn.classList.add('logged-in'); btn.title = user.email; }
    if (label)   label.textContent = user.email.split('@')[0];
    if (emailEl) emailEl.textContent = user.email;
  } else {
    if (btn)     { btn.textContent = '?'; btn.classList.remove('logged-in'); btn.title = 'Sign In'; }
    if (label)   label.textContent = 'Sign In';
    if (emailEl) emailEl.textContent = '';
  }
}

// ── Exports ─────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    showLoadingOverlay, hideLoadingOverlay,
    updateUserPlanBadge,
    showPaywallModal, hidePaywallModal,
    blurPremiumContent, unblurPremiumContent,
    showAuthError, showAuthSuccess, updateAuthNavUI
  };
} else {
  window.GeoUI = {
    showLoadingOverlay, hideLoadingOverlay,
    updateUserPlanBadge,
    showPaywallModal, hidePaywallModal,
    blurPremiumContent, unblurPremiumContent,
    showAuthError, showAuthSuccess, updateAuthNavUI
  };
}
