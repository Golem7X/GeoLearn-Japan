// ============================================================
// GeoLearn Japan — Activation Form Flow Tests
// Simulates the two-path activation flow:
//   Path A: Local GLJP checksum validation (admin-generated keys)
//   Path B: Edge Function (server GEOLEARN keys via Supabase)
// Tests localStorage state management and integrity signature logic.
// ============================================================
'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ── Minimal localStorage mock ────────────────────────────────────────────────
function makeStorage() {
  const store = Object.create(null);
  return {
    getItem:    (k)    => store[k] !== undefined ? store[k] : null,
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: (k)    => { delete store[k]; },
    clear:      ()     => { Object.keys(store).forEach(k => delete store[k]); },
    _store:     store,
  };
}

// ── Re-implement relevant client-side code ───────────────────────────────────

// Salt
const _S = [
  [0x47,0x65,0x6F,0x4C,0x65,0x61,0x72,0x6E],
  [0x4A,0x50,0x5F,0x32,0x30,0x32,0x36],
  [0x50,0x72,0x65,0x6D,0x69,0x75,0x6D],
  [0x4D,0x59,0x4F,0x5F,0x53,0x65,0x63],
];
const SALT = _S.map(a => a.map(c => String.fromCharCode(c)).join('')).join('_');

function _cs256(body) {
  const s = body + SALT;
  let h1 = 5381, h2 = 0x811c9dc5, h3 = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + c) & 0xFFFFFFFF;
    h2 = (h2 ^ c) * 0x01000193 & 0xFFFFFFFF;
    h3 = (h3 * 31 + c + i * 17) & 0xFFFFFFFF;
  }
  for (let r = 0; r < 3; r++) {
    h1 = ((h1 ^ (h1 >>> 16)) * 0x45d9f3b)   & 0xFFFFFFFF;
    h2 = ((h2 ^ (h2 >>> 13)) * 0x119de1f3)  & 0xFFFFFFFF;
    h3 = ((h3 ^ (h3 >>> 11)) * 0x1b873593)  & 0xFFFFFFFF;
  }
  const combined = ((h1 >>> 0) ^ (h2 >>> 0) ^ (h3 >>> 0)) >>> 0;
  const part1 = (h1 >>> 0).toString(36).toUpperCase().slice(-4);
  const part2 = combined.toString(36).toUpperCase().slice(-4);
  return (part1 + part2).padStart(8, '0').slice(-8);
}

const _EPOCH_YEAR = 2026, _EPOCH_MONTH = 0;

function _encodeExpiry(months) {
  if (typeof months !== 'number') months = 12;
  const now = new Date();
  const m = (now.getFullYear() - _EPOCH_YEAR) * 12 + (now.getMonth() - _EPOCH_MONTH) + months;
  return (m >>> 0).toString(36).toUpperCase().padStart(4, '0').slice(-4);
}
function _decodeExpiry(code) {
  return new Date(_EPOCH_YEAR, _EPOCH_MONTH + parseInt(code, 36), 1);
}
function _isExpired(code) {
  try { return _decodeExpiry(code) < new Date(); } catch { return true; }
}

function _genKey(months = 12) {
  const ch = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
  let p1 = '', p2 = '';
  const rnd = new Uint32Array(16);
  try { crypto.getRandomValues(rnd); } catch {
    for (let x = 0; x < 16; x++) rnd[x] = Math.floor(Math.random() * 0xFFFFFFFF);
  }
  for (let i = 0; i < 8; i++) p1 += ch[rnd[i] % ch.length];
  for (let i = 0; i < 8; i++) p2 += ch[rnd[i + 8] % ch.length];
  const exp = _encodeExpiry(months);
  const body = `${p1}-${p2}-${exp}`;
  return `GLJP-${p1}-${p2}-${exp}-${_cs256(body)}`;
}

function _valGenKey(key) {
  if (!key || typeof key !== 'string') return false;
  const pts = key.trim().toUpperCase().split('-');
  if (pts.length === 5 && pts[0] === 'GLJP') {
    if (!/^[A-Z0-9]{8}$/.test(pts[1]) || !/^[A-Z0-9]{8}$/.test(pts[2])) return false;
    if (!/^[A-Z0-9]{4}$/.test(pts[3])) return false;
    if (!/^[A-Z0-9]{8}$/.test(pts[4])) return false;
    return pts[4] === _cs256(`${pts[1]}-${pts[2]}-${pts[3]}`);
  }
  return false;
}

function _keyExpired(key) {
  const pts = (key || '').trim().toUpperCase().split('-');
  if (pts.length === 5 && pts[0] === 'GLJP') return _isExpired(pts[3]);
  return false;
}

// Integrity signing (simplified version of _signState from index.html)
function _signState(status, encodedKey, date, deviceId) {
  const raw = `${status}|${encodedKey}|${date}|${deviceId}`;
  return _cs256(raw);
}

// activatePremium — writes to the provided localStorage mock
function activatePremium(key, storage, deviceId = 'test-device') {
  if (!_valGenKey(key)) return false;
  if (_keyExpired(key))  return false;
  try {
    const date       = new Date().toISOString();
    const encodedKey = Buffer.from(key.trim().toUpperCase()).toString('base64');
    storage.setItem('GeoLearn_Premium_Status',  'true');
    storage.setItem('GeoLearn_License_Key',      encodedKey);
    storage.setItem('GeoLearn_Activation_Date',  date);
    storage.setItem('GeoLearn_Device_ID',        deviceId);
    storage.setItem('GeoLearn_Integrity_Sig',    _signState('true', encodedKey, date, deviceId));
    return true;
  } catch { return false; }
}

// deactivatePremium — clears all premium keys
function deactivatePremium(storage) {
  ['GeoLearn_Premium_Status','GeoLearn_License_Key',
   'GeoLearn_Activation_Date','GeoLearn_Device_ID',
   'GeoLearn_Integrity_Sig'].forEach(k => storage.removeItem(k));
}

// isPremium — checks status + integrity
function isPremium(storage) {
  if (storage.getItem('GeoLearn_Premium_Status') !== 'true') return false;
  const encodedKey = storage.getItem('GeoLearn_License_Key');
  const date       = storage.getItem('GeoLearn_Activation_Date');
  const deviceId   = storage.getItem('GeoLearn_Device_ID');
  const storedSig  = storage.getItem('GeoLearn_Integrity_Sig');
  if (!encodedKey || !date || !storedSig) return false;
  return storedSig === _signState('true', encodedKey, date, deviceId);
}

// Mock activateLicenseViaEdge (simulates network call result)
function makeMockEdgeActivate(shouldSucceed, error = 'Invalid license key.') {
  return async (key) => {
    if (shouldSucceed) return { success: true };
    return { success: false, error };
  };
}

// Simulate the activation form handler
async function runActivationFlow(key, storage, mockEdgeFn) {
  const trimmed = key.trim();
  if (!trimmed) return { status: 'error', message: 'Please enter a license key.' };

  // Path A: local GLJP checksum
  if (activatePremium(trimmed, storage)) {
    return { status: 'success', path: 'local' };
  }

  // Path B: edge function
  const result = await mockEdgeFn(trimmed);
  if (result.success) {
    storage.setItem('GeoLearn_Premium_Status', 'true');
    return { status: 'success', path: 'edge' };
  }
  return { status: 'error', message: result.error };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('activatePremium() — Path A (local GLJP keys)', () => {
  let storage;
  beforeEach(() => { storage = makeStorage(); });

  test('activates a valid, non-expired key', () => {
    const key = _genKey(12);
    assert.ok(activatePremium(key, storage));
    assert.equal(storage.getItem('GeoLearn_Premium_Status'), 'true');
  });

  test('rejects an invalid key', () => {
    assert.equal(activatePremium('NOT-A-VALID-KEY', storage), false);
    assert.equal(storage.getItem('GeoLearn_Premium_Status'), null);
  });

  test('rejects an expired key', () => {
    const parts = _genKey(12).split('-');
    const pastCode = _encodeExpiry(-1);
    const body     = `${parts[1]}-${parts[2]}-${pastCode}`;
    const expiredKey = `GLJP-${parts[1]}-${parts[2]}-${pastCode}-${_cs256(body)}`;
    assert.equal(activatePremium(expiredKey, storage), false);
  });

  test('sets all 5 required localStorage keys', () => {
    const key = _genKey(12);
    activatePremium(key, storage);
    assert.equal(storage.getItem('GeoLearn_Premium_Status'), 'true');
    assert.ok(storage.getItem('GeoLearn_License_Key'),      'License key must be stored');
    assert.ok(storage.getItem('GeoLearn_Activation_Date'),  'Activation date must be stored');
    assert.ok(storage.getItem('GeoLearn_Device_ID'),        'Device ID must be stored');
    assert.ok(storage.getItem('GeoLearn_Integrity_Sig'),    'Integrity sig must be stored');
  });

  test('license key is stored base64-encoded', () => {
    const key = _genKey(12);
    activatePremium(key, storage);
    const stored  = storage.getItem('GeoLearn_License_Key');
    const decoded = Buffer.from(stored, 'base64').toString('utf8');
    assert.equal(decoded, key.trim().toUpperCase());
  });
});

describe('isPremium() — integrity verification', () => {
  let storage;
  beforeEach(() => { storage = makeStorage(); });

  test('returns true after valid activation', () => {
    const key = _genKey(12);
    activatePremium(key, storage, 'device-fingerprint-123');
    assert.ok(isPremium(storage));
  });

  test('returns false when status key is missing', () => {
    assert.equal(isPremium(storage), false);
  });

  test('returns false after deactivation', () => {
    activatePremium(_genKey(12), storage);
    deactivatePremium(storage);
    assert.equal(isPremium(storage), false);
  });

  test('detects tampering: manually setting status to true fails integrity check', () => {
    storage.setItem('GeoLearn_Premium_Status', 'true');
    // No signature written → isPremium must return false
    assert.equal(isPremium(storage), false);
  });

  test('detects signature corruption', () => {
    activatePremium(_genKey(12), storage);
    storage.setItem('GeoLearn_Integrity_Sig', '00000000'); // corrupt the sig
    assert.equal(isPremium(storage), false);
  });
});

describe('deactivatePremium()', () => {
  let storage;
  beforeEach(() => { storage = makeStorage(); });

  test('clears all premium keys from storage', () => {
    activatePremium(_genKey(12), storage);
    deactivatePremium(storage);
    const KEYS = ['GeoLearn_Premium_Status','GeoLearn_License_Key',
                  'GeoLearn_Activation_Date','GeoLearn_Device_ID','GeoLearn_Integrity_Sig'];
    for (const k of KEYS) {
      assert.equal(storage.getItem(k), null, `${k} should be removed`);
    }
  });

  test('is idempotent — safe to call when not activated', () => {
    assert.doesNotThrow(() => deactivatePremium(storage));
  });
});

describe('Activation form flow simulation', () => {
  let storage;
  beforeEach(() => { storage = makeStorage(); });

  test('Path A — valid GLJP key activates locally (no network call)', async () => {
    const key   = _genKey(12);
    const mockEdge = makeMockEdgeActivate(false, 'should not be called');
    const result   = await runActivationFlow(key, storage, mockEdge);
    assert.equal(result.status, 'success');
    assert.equal(result.path,   'local');
    assert.ok(isPremium(storage));
  });

  test('Path A — expired GLJP key falls through to Path B', async () => {
    const parts    = _genKey(12).split('-');
    const pastCode = _encodeExpiry(-1);
    const body     = `${parts[1]}-${parts[2]}-${pastCode}`;
    const expiredKey = `GLJP-${parts[1]}-${parts[2]}-${pastCode}-${_cs256(body)}`;

    // Edge succeeds (simulating DB holds this key as valid)
    const result = await runActivationFlow(expiredKey, storage, makeMockEdgeActivate(true));
    // Local rejects expired key; edge succeeds
    assert.equal(result.status, 'success');
    assert.equal(result.path,   'edge');
  });

  test('Path B — server GEOLEARN key activates via edge function', async () => {
    const serverKey = 'GEOLEARN-2026-W2ZC-729Z';
    const result    = await runActivationFlow(serverKey, storage, makeMockEdgeActivate(true));
    assert.equal(result.status, 'success');
    assert.equal(result.path,   'edge');
  });

  test('Path B — invalid key rejected by both paths', async () => {
    const result = await runActivationFlow('INVALID-KEY', storage, makeMockEdgeActivate(false));
    assert.equal(result.status, 'error');
    assert.ok(result.message);
  });

  test('empty key returns early with error', async () => {
    const result = await runActivationFlow('', storage, makeMockEdgeActivate(true));
    assert.equal(result.status, 'error');
  });

  test('edge function error message is surfaced to caller', async () => {
    const serverKey = 'GEOLEARN-2026-FAKE-FAKE';
    const result    = await runActivationFlow(
      serverKey, storage,
      makeMockEdgeActivate(false, 'This license key has expired.')
    );
    assert.equal(result.status,  'error');
    assert.equal(result.message, 'This license key has expired.');
  });
});

describe('Rate limiting — client-side (10-minute window)', () => {
  function makeRateLimiter(max = 5, windowMs = 600_000) {
    const attempts = [];
    return {
      ok() {
        const cutoff = Date.now() - windowMs;
        while (attempts.length && attempts[0] < cutoff) attempts.shift();
        if (attempts.length >= max) return false;
        attempts.push(Date.now());
        return true;
      },
      get count() { return attempts.length; },
    };
  }

  test('allows up to 5 attempts', () => {
    const rl = makeRateLimiter();
    for (let i = 0; i < 5; i++) assert.ok(rl.ok(), `Attempt ${i+1} should be allowed`);
  });

  test('blocks the 6th attempt', () => {
    const rl = makeRateLimiter();
    for (let i = 0; i < 5; i++) rl.ok();
    assert.equal(rl.ok(), false);
  });

  test('fresh limiter always allows first attempt', () => {
    assert.ok(makeRateLimiter().ok());
  });
});
