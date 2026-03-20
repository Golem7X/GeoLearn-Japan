/**
 * GeoLearn Japan — Authentication Module (auth.js)
 * ══════════════════════════════════════════════════
 * Handles all Supabase authentication:
 *   - Magic Link (passwordless email sign-in) — PRIMARY
 *   - Email + Password (sign in / sign up)     — SECONDARY
 *   - Session persistence (auto-restored on page load)
 *   - Secure sign-out
 *
 * Security notes:
 *   - Session tokens are stored in Supabase's own storage (httpOnly-equivalent)
 *   - Premium status is NEVER stored in localStorage
 *   - Magic Links expire after 1 hour (Supabase default)
 *
 * Copyright (c) 2026 MYO NAING TUN / MYO_Geo_Orgs. All Rights Reserved.
 */
'use strict';

// ── Get Supabase client ─────────────────────────────────────
function getClient() {
  return window._geoSupaClient || null;
}

// ── getCurrentSession ───────────────────────────────────────
/**
 * Returns the current Supabase session, or null if not signed in.
 * Persists across page refreshes automatically.
 * @returns {Promise<Object|null>}
 */
async function getCurrentSession() {
  var client = getClient();
  if (!client) return null;
  try {
    var result = await client.auth.getSession();
    return result.data && result.data.session ? result.data.session : null;
  } catch (e) {
    return null;
  }
}

// ── sendMagicLink ───────────────────────────────────────────
/**
 * Send a Magic Link (OTP) to the user's email.
 * User clicks the link → gets signed in automatically.
 * No password required.
 *
 * @param {string} email
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendMagicLink(email) {
  var client = getClient();
  if (!client) return { success: false, message: 'Supabase connection unavailable.' };
  if (!email || !email.trim()) return { success: false, message: 'Email is required.' };

  try {
    var result = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    });
    if (result.error) throw result.error;
    return {
      success: true,
      message: '\u2713 Magic link sent! Check your inbox and click the link to sign in.'
    };
  } catch (e) {
    return { success: false, message: e.message || 'Failed to send magic link. Try again.' };
  }
}

// ── signInWithPassword ──────────────────────────────────────
/**
 * Sign in with email + password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, user: Object|null, message: string}>}
 */
async function signInWithPassword(email, password) {
  var client = getClient();
  if (!client) return { success: false, user: null, message: 'Connection unavailable.' };

  try {
    var result = await client.auth.signInWithPassword({ email: email.trim(), password: password });
    if (result.error) throw result.error;
    return { success: true, user: result.data.user, message: 'Signed in successfully!' };
  } catch (e) {
    return { success: false, user: null, message: e.message || 'Sign in failed.' };
  }
}

// ── signUp ──────────────────────────────────────────────────
/**
 * Create a new account with email + password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, requiresConfirmation: boolean, message: string}>}
 */
async function signUp(email, password) {
  var client = getClient();
  if (!client) return { success: false, requiresConfirmation: false, message: 'Connection unavailable.' };

  try {
    var result = await client.auth.signUp({ email: email.trim(), password: password });
    if (result.error) throw result.error;
    var needsConfirm = result.data.user && !result.data.session;
    return {
      success: true,
      requiresConfirmation: needsConfirm,
      message: needsConfirm
        ? 'Account created! Check your email to confirm, then sign in.'
        : 'Account created and signed in!'
    };
  } catch (e) {
    return { success: false, requiresConfirmation: false, message: e.message || 'Sign up failed.' };
  }
}

// ── signOut ─────────────────────────────────────────────────
/**
 * Sign out the current user. Clears session securely.
 * @returns {Promise<void>}
 */
async function signOut() {
  var client = getClient();
  if (!client) return;
  try { await client.auth.signOut(); } catch (e) {}
}

// ── resetPassword ────────────────────────────────────────────
/**
 * Send a password reset email.
 * @param {string} email
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function resetPassword(email) {
  var client = getClient();
  if (!client) return { success: false, message: 'Connection unavailable.' };
  if (!email || !email.trim()) return { success: false, message: 'Enter your email first.' };

  try {
    var result = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (result.error) throw result.error;
    return { success: true, message: 'Password reset email sent! Check your inbox.' };
  } catch (e) {
    return { success: false, message: e.message || 'Failed to send reset email.' };
  }
}

// ── onAuthStateChange ────────────────────────────────────────
/**
 * Subscribe to auth state changes.
 * @param {Function} callback - (event, session) => void
 */
function onAuthStateChange(callback) {
  var client = getClient();
  if (!client) return;
  client.auth.onAuthStateChange(callback);
}

// ── Exports ─────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getCurrentSession, sendMagicLink, signInWithPassword, signUp, signOut, resetPassword, onAuthStateChange };
} else {
  window.GeoAuth = { getCurrentSession, sendMagicLink, signInWithPassword, signUp, signOut, resetPassword, onAuthStateChange };
}
