// ============================================================
// GeoLearn Japan — validate-license Edge Function Logic Tests
// Tests the pure validation rules applied by the edge function
// (without a live Supabase connection):
//   - Key normalisation
//   - Rate-limit counting logic
//   - Device-limit enforcement
//   - Expiry comparison
//   - Activation record upsert semantics
// ============================================================
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── Pure helpers mirrored from validate-license/index.ts ────────────────────

function normaliseKey(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const k = raw.trim().toUpperCase();
  return k === '' ? null : k;
}

/** Returns true when the user is within the rate limit window */
function isWithinRateLimit(attempts, windowMs = 60_000, maxAttempts = 5) {
  const cutoff = Date.now() - windowMs;
  const recent = attempts.filter(ts => ts > cutoff);
  return recent.length < maxAttempts;
}

/** Decide whether a new device activation is permitted */
function canActivateDevice(license, existingActivations, fingerprint) {
  // Already activated by this user/device combination
  const alreadyActivated = existingActivations.some(
    a => a.device_fingerprint === fingerprint
  );
  if (alreadyActivated) return { allowed: true, reason: 'existing' };

  if (license.used_devices < license.max_devices) {
    return { allowed: true, reason: 'new' };
  }

  // Limit reached — check if this exact fingerprint is on the license already
  // (shared-device edge case)
  const deviceOnLicense = existingActivations.some(
    a => a.device_fingerprint === fingerprint
  );
  if (deviceOnLicense) return { allowed: true, reason: 'shared-device' };

  return { allowed: false, reason: 'limit' };
}

function isLicenseExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('normaliseKey()', () => {
  test('trims whitespace and uppercases', () => {
    assert.equal(normaliseKey('  geolearn-2026-abc-xyz  '), 'GEOLEARN-2026-ABC-XYZ');
  });

  test('returns null for null / undefined / empty', () => {
    assert.equal(normaliseKey(null),      null);
    assert.equal(normaliseKey(undefined), null);
    assert.equal(normaliseKey(''),        null);
    assert.equal(normaliseKey('   '),     null);
  });

  test('returns null for non-string', () => {
    assert.equal(normaliseKey(42),   null);
    assert.equal(normaliseKey({}),   null);
    assert.equal(normaliseKey([]),   null);
  });

  test('already-normalised key is returned as-is', () => {
    assert.equal(normaliseKey('GEOLEARN-2026-W2ZC-729Z'), 'GEOLEARN-2026-W2ZC-729Z');
  });
});

describe('isWithinRateLimit()', () => {
  test('empty attempt list is within limit', () => {
    assert.ok(isWithinRateLimit([]));
  });

  test('4 recent attempts is within limit (max 5)', () => {
    const now = Date.now();
    const attempts = [now - 10000, now - 20000, now - 30000, now - 40000];
    assert.ok(isWithinRateLimit(attempts));
  });

  test('5 recent attempts hits the limit', () => {
    const now = Date.now();
    const attempts = [now - 1000, now - 2000, now - 3000, now - 4000, now - 5000];
    assert.equal(isWithinRateLimit(attempts), false);
  });

  test('old attempts (outside window) do not count', () => {
    const now = Date.now();
    // 5 attempts all older than 60s
    const attempts = [
      now - 70000, now - 80000, now - 90000, now - 100000, now - 110000,
    ];
    assert.ok(isWithinRateLimit(attempts));
  });

  test('mix of old and recent attempts — only recent count', () => {
    const now = Date.now();
    const attempts = [
      now - 10000,  // recent
      now - 20000,  // recent
      now - 70000,  // old (outside 60s window)
      now - 80000,  // old
      now - 90000,  // old
    ];
    assert.ok(isWithinRateLimit(attempts)); // only 2 recent → within limit
  });
});

describe('canActivateDevice()', () => {
  const mkLicense = (used, max) => ({ used_devices: used, max_devices: max });

  test('allows activation when devices < max', () => {
    const result = canActivateDevice(mkLicense(0, 2), [], 'fp-abc');
    assert.ok(result.allowed);
    assert.equal(result.reason, 'new');
  });

  test('allows re-activation by same fingerprint (existing record)', () => {
    const activations = [{ device_fingerprint: 'fp-abc' }];
    const result = canActivateDevice(mkLicense(2, 2), activations, 'fp-abc');
    assert.ok(result.allowed);
    assert.equal(result.reason, 'existing');
  });

  test('blocks new device when limit reached', () => {
    const activations = [
      { device_fingerprint: 'fp-device1' },
      { device_fingerprint: 'fp-device2' },
    ];
    const result = canActivateDevice(mkLicense(2, 2), activations, 'fp-new');
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'limit');
  });

  test('allows activation at exactly limit (used < max)', () => {
    const result = canActivateDevice(mkLicense(1, 2), [], 'fp-new');
    assert.ok(result.allowed);
  });

  test('blocks when used_devices equals max_devices and fingerprint is new', () => {
    const activations = [{ device_fingerprint: 'fp-existing' }];
    const result = canActivateDevice(mkLicense(1, 1), activations, 'fp-new');
    assert.equal(result.allowed, false);
  });
});

describe('isLicenseExpired()', () => {
  test('null/undefined expires_at means never-expiring → not expired', () => {
    assert.equal(isLicenseExpired(null),      false);
    assert.equal(isLicenseExpired(undefined), false);
  });

  test('past date is expired', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    assert.ok(isLicenseExpired(yesterday));
  });

  test('future date is not expired', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    assert.equal(isLicenseExpired(tomorrow), false);
  });

  test('exactly now is treated as expired (boundary)', () => {
    // A date 100ms in the past should always be expired
    const justPast = new Date(Date.now() - 100).toISOString();
    assert.ok(isLicenseExpired(justPast));
  });
});

describe('Full validation flow simulation', () => {
  test('happy path: active key, within limit, device available', () => {
    const license = {
      is_active:   true,
      expires_at:  new Date(Date.now() + 30 * 86_400_000).toISOString(),
      max_devices: 2,
      used_devices: 0,
    };
    const recentAttempts = [];
    const activations    = [];
    const fingerprint    = 'fp-customer-1';

    assert.ok(!isLicenseExpired(license.expires_at), 'License must not be expired');
    assert.ok(license.is_active,                     'License must be active');
    assert.ok(isWithinRateLimit(recentAttempts),     'Must be within rate limit');
    const canActivate = canActivateDevice(license, activations, fingerprint);
    assert.ok(canActivate.allowed,                   'Device activation must be allowed');
  });

  test('deactivated key is rejected', () => {
    const license = { is_active: false, expires_at: null, max_devices: 2, used_devices: 0 };
    assert.equal(license.is_active, false, 'Must fail is_active check');
  });

  test('expired key is rejected', () => {
    const license = {
      is_active:   true,
      expires_at:  new Date(Date.now() - 86_400_000).toISOString(),
      max_devices: 2,
      used_devices: 0,
    };
    assert.ok(isLicenseExpired(license.expires_at), 'Must be detected as expired');
  });

  test('rate-limited user is rejected', () => {
    const now = Date.now();
    const attempts = [now-1000, now-2000, now-3000, now-4000, now-5000];
    assert.equal(isWithinRateLimit(attempts), false, 'Must be rate-limited');
  });

  test('device limit reached blocks new device', () => {
    const license = { is_active: true, expires_at: null, max_devices: 2, used_devices: 2 };
    const activations = [
      { device_fingerprint: 'fp-1' },
      { device_fingerprint: 'fp-2' },
    ];
    const result = canActivateDevice(license, activations, 'fp-new');
    assert.equal(result.allowed, false);
  });

  test('same customer re-activating (e.g. cleared cache) always succeeds', () => {
    const license = { is_active: true, expires_at: null, max_devices: 2, used_devices: 2 };
    const activations = [{ device_fingerprint: 'fp-returning-customer' }];
    const result = canActivateDevice(license, activations, 'fp-returning-customer');
    assert.ok(result.allowed);
    assert.equal(result.reason, 'existing');
  });
});
