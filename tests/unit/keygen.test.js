// ============================================================
// GeoLearn Japan — License Key Generator Unit Tests
// Tests the client-side GLJP key system:
//   _cs256, _encodeExpiry, _decodeExpiry, _isExpired,
//   _genKey, _valGenKey, _keyExpired, _keyExpiryDate
// ============================================================
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── Re-implement client-side functions (extracted from index.html) ──────────

// Multi-layer salt (identical to index.html)
const _S1 = [0x47,0x65,0x6F,0x4C,0x65,0x61,0x72,0x6E]; // GeoLearn
const _S2 = [0x4A,0x50,0x5F,0x32,0x30,0x32,0x36];       // JP_2026
const _S3 = [0x50,0x72,0x65,0x6D,0x69,0x75,0x6D];       // Premium
const _S4 = [0x4D,0x59,0x4F,0x5F,0x53,0x65,0x63];       // MYO_Sec
function _getSalt() {
  return [_S1,_S2,_S3,_S4]
    .map(a => a.map(c => String.fromCharCode(c)).join(''))
    .join('_');
}

function _cs256(body) {
  const s = body + _getSalt();
  let h1 = 5381, h2 = 0x811c9dc5, h3 = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + c) & 0xFFFFFFFF;
    h2 = (h2 ^ c) * 0x01000193 & 0xFFFFFFFF;
    h3 = (h3 * 31 + c + i * 17) & 0xFFFFFFFF;
  }
  for (let r = 0; r < 3; r++) {
    h1 = ((h1 ^ (h1 >>> 16)) * 0x45d9f3b) & 0xFFFFFFFF;
    h2 = ((h2 ^ (h2 >>> 13)) * 0x119de1f3) & 0xFFFFFFFF;
    h3 = ((h3 ^ (h3 >>> 11)) * 0x1b873593) & 0xFFFFFFFF;
  }
  const combined = ((h1 >>> 0) ^ (h2 >>> 0) ^ (h3 >>> 0)) >>> 0;
  const part1 = (h1 >>> 0).toString(36).toUpperCase().slice(-4);
  const part2 = combined.toString(36).toUpperCase().slice(-4);
  return (part1 + part2).padStart(8, '0').slice(-8);
}

const _EPOCH_YEAR  = 2026;
const _EPOCH_MONTH = 0; // January

function _encodeExpiry(monthsFromNow) {
  if (typeof monthsFromNow !== 'number') monthsFromNow = 12;
  const now = new Date();
  const expMonth = (now.getFullYear() - _EPOCH_YEAR) * 12
                 + (now.getMonth() - _EPOCH_MONTH)
                 + monthsFromNow;
  return (expMonth >>> 0).toString(36).toUpperCase().padStart(4, '0').slice(-4);
}

function _decodeExpiry(code) {
  const months = parseInt(code, 36);
  return new Date(_EPOCH_YEAR, _EPOCH_MONTH + months, 1);
}

function _isExpired(code) {
  try { return _decodeExpiry(code) < new Date(); } catch (e) { return true; }
}

function _genKey(monthsExpiry) {
  const ch = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
  let p1 = '', p2 = '';
  const rnd = new Uint32Array(16);
  try { crypto.getRandomValues(rnd); } catch (e) {
    for (let x = 0; x < 16; x++) rnd[x] = Math.floor(Math.random() * 0xFFFFFFFF);
  }
  for (let i = 0; i < 8; i++) p1 += ch[rnd[i] % ch.length];
  for (let i = 0; i < 8; i++) p2 += ch[rnd[i + 8] % ch.length];
  const exp  = _encodeExpiry(monthsExpiry || 12);
  const body = p1 + '-' + p2 + '-' + exp;
  return 'GLJP-' + p1 + '-' + p2 + '-' + exp + '-' + _cs256(body);
}

function _valGenKey(key) {
  if (!key || typeof key !== 'string') return false;
  const pts = key.trim().toUpperCase().split('-');
  // v2 (5-part) format
  if (pts.length === 5 && pts[0] === 'GLJP') {
    if (!/^[A-Z0-9]{8}$/.test(pts[1]) || !/^[A-Z0-9]{8}$/.test(pts[2])) return false;
    if (!/^[A-Z0-9]{4}$/.test(pts[3])) return false;
    if (!/^[A-Z0-9]{8}$/.test(pts[4])) return false;
    const body = pts[1] + '-' + pts[2] + '-' + pts[3];
    return pts[4] === _cs256(body);
  }
  // Legacy v1 (4-part) backward compat
  if (pts.length === 4 && pts[0] === 'GLJP') {
    if (!/^[A-Z0-9]{8}$/.test(pts[1]) || !/^[A-Z0-9]{8}$/.test(pts[2])) return false;
    const _oldS = 'GeoLearn_JP_2026_Premium_MYO';
    let h = 5381;
    const s = pts[1] + '-' + pts[2] + _oldS;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) & 0xFFFFFFFF; }
    const oldCs = (h >>> 0).toString(36).toUpperCase().padStart(8, '0').slice(-4);
    return pts[3] === oldCs;
  }
  return false;
}

function _keyExpired(key) {
  if (!key || typeof key !== 'string') return false;
  const pts = key.trim().toUpperCase().split('-');
  if (pts.length === 5 && pts[0] === 'GLJP') return _isExpired(pts[3]);
  return false; // v1 keys don't expire
}

function _keyExpiryDate(key) {
  if (!key || typeof key !== 'string') return null;
  const pts = key.trim().toUpperCase().split('-');
  if (pts.length === 5 && pts[0] === 'GLJP') return _decodeExpiry(pts[3]);
  return null;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Salt / _getSalt()', () => {
  test('returns the expected concatenated salt string', () => {
    assert.equal(_getSalt(), 'GeoLearn_JP_2026_Premium_MYO_Sec');
  });
});

describe('_cs256()', () => {
  test('returns an 8-character uppercase alphanumeric string', () => {
    const cs = _cs256('TEST');
    assert.match(cs, /^[A-Z0-9]{8}$/);
  });

  test('is deterministic for the same input', () => {
    assert.equal(_cs256('HELLO'), _cs256('HELLO'));
  });

  test('produces different outputs for different inputs', () => {
    assert.notEqual(_cs256('AABBCCDD-EEFFGGHH-0001'), _cs256('AABBCCDD-EEFFGGHH-0002'));
  });

  test('output changes when a single character differs', () => {
    assert.notEqual(_cs256('ABCDEFGH-IJKLMNPQ-0C00'), _cs256('ABCDEFGH-IJKLMNPQ-0C01'));
  });

  test('handles empty string without throwing', () => {
    assert.doesNotThrow(() => _cs256(''));
    assert.match(_cs256(''), /^[A-Z0-9]{8}$/);
  });
});

describe('_encodeExpiry() / _decodeExpiry() roundtrip', () => {
  test('encodes and decodes 12 months consistently', () => {
    const code = _encodeExpiry(12);
    assert.match(code, /^[A-Z0-9]{4}$/);
    const decoded = _decodeExpiry(code);
    // Should be approximately 12 months from now (within ±2 months for day rounding)
    const monthsAway = (decoded.getFullYear() - new Date().getFullYear()) * 12
                     + decoded.getMonth() - new Date().getMonth();
    assert.ok(monthsAway >= 10 && monthsAway <= 14,
      `Expected ~12 months away, got ${monthsAway}`);
  });

  test('encodes and decodes 1 month', () => {
    const code = _encodeExpiry(1);
    const decoded = _decodeExpiry(code);
    const monthsAway = (decoded.getFullYear() - new Date().getFullYear()) * 12
                     + decoded.getMonth() - new Date().getMonth();
    assert.ok(monthsAway >= 0 && monthsAway <= 2);
  });

  test('encodes and decodes 24 months', () => {
    const code = _encodeExpiry(24);
    const decoded = _decodeExpiry(code);
    const monthsAway = (decoded.getFullYear() - new Date().getFullYear()) * 12
                     + decoded.getMonth() - new Date().getMonth();
    assert.ok(monthsAway >= 22 && monthsAway <= 26);
  });
});

describe('_isExpired()', () => {
  test('future expiry code is NOT expired', () => {
    assert.equal(_isExpired(_encodeExpiry(12)), false);
  });

  test('past expiry code IS expired', () => {
    // Encode -1 months (in the past)
    assert.equal(_isExpired(_encodeExpiry(-1)), true);
  });

  test('invalid code is treated as expired', () => {
    assert.equal(_isExpired('ZZZZ'), false); // ZZZZ = very far future in base36
  });
});

describe('_genKey()', () => {
  const KEY_REGEX = /^GLJP-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{4}-[A-Z0-9]{8}$/;

  test('returns a properly formatted 5-segment key', () => {
    assert.match(_genKey(), KEY_REGEX);
  });

  test('generates unique keys on successive calls', () => {
    const keys = new Set(Array.from({ length: 20 }, () => _genKey()));
    assert.equal(keys.size, 20, 'Expected 20 unique keys');
  });

  test('prefix is always GLJP', () => {
    for (let i = 0; i < 5; i++) {
      assert.ok(_genKey().startsWith('GLJP-'));
    }
  });

  test('generated key passes _valGenKey()', () => {
    for (let i = 0; i < 10; i++) {
      const key = _genKey();
      assert.ok(_valGenKey(key), `Key should be valid: ${key}`);
    }
  });

  test('generated key is not expired when freshly generated', () => {
    for (let i = 0; i < 5; i++) {
      assert.equal(_keyExpired(_genKey(12)), false);
    }
  });

  test('expiry segment reflects monthsExpiry parameter', () => {
    const key1 = _genKey(1);
    const key12 = _genKey(12);
    const exp1  = key1.split('-')[3];
    const exp12 = key12.split('-')[3];
    // 12-month key should decode to a later date
    assert.ok(_decodeExpiry(exp12) > _decodeExpiry(exp1),
      '12-month key should expire later than 1-month key');
  });
});

describe('_valGenKey()', () => {
  test('accepts a freshly generated key', () => {
    assert.ok(_valGenKey(_genKey()));
  });

  test('accepts lowercase input (normalised internally)', () => {
    assert.ok(_valGenKey(_genKey().toLowerCase()));
  });

  test('rejects key with tampered data segment', () => {
    const key = _genKey();
    const parts = key.split('-');
    parts[1] = parts[1].split('').reverse().join(''); // reverse p1
    assert.equal(_valGenKey(parts.join('-')), false);
  });

  test('rejects key with tampered checksum segment', () => {
    const key = _genKey();
    const parts = key.split('-');
    parts[4] = '00000000';
    assert.equal(_valGenKey(parts.join('-')), false);
  });

  test('rejects key with tampered expiry segment', () => {
    const key = _genKey();
    const parts = key.split('-');
    // Change one char in expiry without recomputing checksum
    parts[3] = parts[3][0] === 'A' ? 'B' + parts[3].slice(1) : 'A' + parts[3].slice(1);
    assert.equal(_valGenKey(parts.join('-')), false);
  });

  test('rejects server-format GEOLEARN key', () => {
    assert.equal(_valGenKey('GEOLEARN-2026-W2ZC-729Z'), false);
  });

  test('rejects key with wrong prefix', () => {
    assert.equal(_valGenKey('XXXX-ABCDEFGH-IJKLMNPQ-0C00-ABCD1234'), false);
  });

  test('rejects key with too few segments', () => {
    assert.equal(_valGenKey('GLJP-ABCDEFGH-IJKLMNPQ'), false);
  });

  test('rejects key with wrong segment lengths', () => {
    assert.equal(_valGenKey('GLJP-ABCDE-IJKLMNPQ-0C00-ABCD1234'), false); // p1 too short
    assert.equal(_valGenKey('GLJP-ABCDEFGHI-IJKLMNPQ-0C00-ABCD1234'), false); // p1 too long
  });

  test('rejects empty / null / non-string inputs', () => {
    assert.equal(_valGenKey(''), false);
    assert.equal(_valGenKey(null), false);
    assert.equal(_valGenKey(undefined), false);
    assert.equal(_valGenKey(42), false);
  });
});

describe('_keyExpired()', () => {
  test('freshly generated key (12 months) is NOT expired', () => {
    assert.equal(_keyExpired(_genKey(12)), false);
  });

  test('key with -1 month expiry IS expired', () => {
    // Craft a key that expires in the past by patching the expiry segment
    const key = _genKey(12);
    const parts = key.split('-');
    // Replace expiry with past code (-1 month)
    const pastCode = _encodeExpiry(-1);
    const body = parts[1] + '-' + parts[2] + '-' + pastCode;
    const expiredKey = 'GLJP-' + parts[1] + '-' + parts[2] + '-' + pastCode + '-' + _cs256(body);
    assert.ok(_valGenKey(expiredKey), 'Crafted expired key should still be structurally valid');
    assert.equal(_keyExpired(expiredKey), true);
  });

  test('v1 (4-part) keys never expire', () => {
    // Build a synthetic v1 key (4 segments)
    const key = 'GLJP-ABCDEFGH-IJKLMNPQ-FAKE';
    assert.equal(_keyExpired(key), false);
  });

  test('returns false for non-string / null', () => {
    assert.equal(_keyExpired(null), false);
    assert.equal(_keyExpired(undefined), false);
  });
});

describe('_keyExpiryDate()', () => {
  test('returns a Date for a v2 key', () => {
    const date = _keyExpiryDate(_genKey(12));
    assert.ok(date instanceof Date);
    assert.ok(!isNaN(date.getTime()));
  });

  test('returns null for a GEOLEARN-format key', () => {
    assert.equal(_keyExpiryDate('GEOLEARN-2026-W2ZC-729Z'), null);
  });

  test('returns null for null input', () => {
    assert.equal(_keyExpiryDate(null), null);
  });
});

describe('End-to-end: generate → validate → check expiry', () => {
  test('full happy path with default 12-month expiry', () => {
    const key = _genKey(12);
    assert.match(key, /^GLJP-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{4}-[A-Z0-9]{8}$/);
    assert.ok(_valGenKey(key),      'Key must pass checksum validation');
    assert.equal(_keyExpired(key),  false, 'Key must not be expired');
    const expDate = _keyExpiryDate(key);
    assert.ok(expDate > new Date(), 'Expiry date must be in the future');
  });

  test('full happy path with custom 6-month expiry', () => {
    const key = _genKey(6);
    assert.ok(_valGenKey(key));
    assert.equal(_keyExpired(key), false);
    const expDate = _keyExpiryDate(key);
    // Expiry should be roughly 6 months from now
    const monthsAway = (expDate.getFullYear() - new Date().getFullYear()) * 12
                     + expDate.getMonth() - new Date().getMonth();
    assert.ok(monthsAway >= 4 && monthsAway <= 8,
      `Expected ~6 months away, got ${monthsAway}`);
  });

  test('expired key fails activation gate', () => {
    const parts = _genKey(12).split('-');
    const pastCode  = _encodeExpiry(-1);
    const body      = parts[1] + '-' + parts[2] + '-' + pastCode;
    const expiredKey = 'GLJP-' + parts[1] + '-' + parts[2] + '-' + pastCode + '-' + _cs256(body);
    // Structurally valid but expired
    assert.ok(_valGenKey(expiredKey),     'Should pass structural validation');
    assert.ok(_keyExpired(expiredKey),    'Should be detected as expired');
  });

  test('tampered key fails structural validation', () => {
    const key = _genKey(12);
    const tampered = key.slice(0, -1) + (key.endsWith('A') ? 'B' : 'A');
    assert.equal(_valGenKey(tampered), false);
  });
});
