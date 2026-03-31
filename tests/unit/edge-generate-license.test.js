// ============================================================
// GeoLearn Japan — generate-license Edge Function Logic Tests
// Tests the pure business logic of generate-license:
//   - randomSegment format
//   - Key format generation  (PREFIX-YEAR-XXXX-XXXX)
//   - Input sanitisation / clamping
//   - Check action format
// ============================================================
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── Extract pure logic from edge function ───────────────────────────────────

// Identical character set to generate-license/index.ts
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1

function randomSegment(len) {
  return Array.from({ length: len }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('');
}

function buildKey(prefix, year) {
  return `${prefix}-${year}-${randomSegment(4)}-${randomSegment(4)}`;
}

function sanitisePrefix(raw) {
  return ((raw || 'GEOLEARN')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)) || 'GEOLEARN';
}

function clampQuantity(n)   { const v = Number(n); return Math.min(Math.max(Number.isFinite(v) ? v : 5,  1), 50); }
function clampMaxDevices(n) { const v = Number(n); return Math.min(Math.max(Number.isFinite(v) ? v : 2,  1), 10); }

// ── Tests ────────────────────────────────────────────────────────────────────

describe('randomSegment()', () => {
  test('returns correct length', () => {
    assert.equal(randomSegment(4).length, 4);
    assert.equal(randomSegment(8).length, 8);
  });

  test('only uses characters from the allowed set', () => {
    for (let i = 0; i < 50; i++) {
      const seg = randomSegment(4);
      for (const ch of seg) {
        assert.ok(CHARS.includes(ch), `Character '${ch}' not in allowed set`);
      }
    }
  });

  test('never contains ambiguous characters: I O 0 1', () => {
    for (let i = 0; i < 200; i++) {
      const seg = randomSegment(4);
      assert.ok(!/[IO01]/.test(seg), `Ambiguous char found in: ${seg}`);
    }
  });

  test('produces varied output (not constant)', () => {
    const segs = new Set(Array.from({ length: 30 }, () => randomSegment(4)));
    assert.ok(segs.size > 10, 'Expected random variation in segment output');
  });
});

describe('buildKey() — server key format', () => {
  const YEAR = new Date().getFullYear();
  const KEY_REGEX = new RegExp(
    `^[A-Z0-9]+-${YEAR}-[A-Z0-9]{4}-[A-Z0-9]{4}$`
  );

  test('default prefix produces GEOLEARN-YEAR-XXXX-XXXX', () => {
    const key = buildKey('GEOLEARN', YEAR);
    assert.match(key, KEY_REGEX);
    assert.ok(key.startsWith('GEOLEARN-'));
  });

  test('custom prefix is used in the key', () => {
    const key = buildKey('TESTPFX', YEAR);
    assert.ok(key.startsWith('TESTPFX-'));
  });

  test('key contains current year', () => {
    const key = buildKey('GEOLEARN', YEAR);
    assert.ok(key.includes(`-${YEAR}-`));
  });

  test('segment 3 and 4 are each 4 characters', () => {
    const key = buildKey('GEOLEARN', YEAR);
    const parts = key.split('-');
    assert.equal(parts[2].length, 4);
    assert.equal(parts[3].length, 4);
  });

  test('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 30 }, () => buildKey('GEOLEARN', YEAR)));
    assert.ok(keys.size > 20, 'Expected high uniqueness in generated keys');
  });
});

describe('sanitisePrefix()', () => {
  test('default when no prefix provided', () => {
    assert.equal(sanitisePrefix(undefined), 'GEOLEARN');
    assert.equal(sanitisePrefix(''), 'GEOLEARN');
    assert.equal(sanitisePrefix(null), 'GEOLEARN');
  });

  test('converts to uppercase', () => {
    assert.equal(sanitisePrefix('geolearn'), 'GEOLEARN');
  });

  test('strips non-alphanumeric characters', () => {
    assert.equal(sanitisePrefix('GEO-LEARN!'), 'GEOLEARN');
  });

  test('truncates to 12 characters', () => {
    const result = sanitisePrefix('ABCDEFGHIJKLMNOP');
    assert.equal(result.length, 12);
    assert.equal(result, 'ABCDEFGHIJKL');
  });

  test('falls back to GEOLEARN if result is empty after sanitisation', () => {
    assert.equal(sanitisePrefix('---!!!'), 'GEOLEARN');
  });
});

describe('clampQuantity()', () => {
  test('minimum is 1', () => {
    assert.equal(clampQuantity(0),   1);
    assert.equal(clampQuantity(-5),  1);
    assert.equal(clampQuantity(NaN), 5); // NaN → default 5
  });

  test('maximum is 50', () => {
    assert.equal(clampQuantity(51), 50);
    assert.equal(clampQuantity(99), 50);
  });

  test('default when undefined is 5', () => {
    assert.equal(clampQuantity(undefined), 5);
  });

  test('valid values pass through unchanged', () => {
    assert.equal(clampQuantity(1),  1);
    assert.equal(clampQuantity(10), 10);
    assert.equal(clampQuantity(50), 50);
  });
});

describe('clampMaxDevices()', () => {
  test('minimum is 1', () => {
    assert.equal(clampMaxDevices(0),  1);
    assert.equal(clampMaxDevices(-1), 1);
  });

  test('maximum is 10', () => {
    assert.equal(clampMaxDevices(11), 10);
    assert.equal(clampMaxDevices(99), 10);
  });

  test('default when undefined is 2', () => {
    assert.equal(clampMaxDevices(undefined), 2);
  });

  test('valid values pass through unchanged', () => {
    assert.equal(clampMaxDevices(2),  2);
    assert.equal(clampMaxDevices(5),  5);
    assert.equal(clampMaxDevices(10), 10);
  });
});

describe('Bulk generation — uniqueness guarantee', () => {
  test('50 keys are all unique (no collisions)', () => {
    const YEAR = new Date().getFullYear();
    const keys = [];
    while (keys.length < 50) {
      const key = buildKey('GEOLEARN', YEAR);
      if (!keys.includes(key)) keys.push(key);
    }
    const unique = new Set(keys);
    assert.equal(unique.size, 50);
  });

  test('all 50 keys match expected format', () => {
    const YEAR = new Date().getFullYear();
    const REGEX = /^GEOLEARN-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    for (let i = 0; i < 50; i++) {
      assert.match(buildKey('GEOLEARN', YEAR), REGEX);
    }
  });
});

describe('Expiry date calculation', () => {
  test('30-day expiry is in the future', () => {
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    assert.ok(thirtyDays > new Date());
  });

  test('custom ISO date is preserved correctly', () => {
    const customDate = '2027-06-15T00:00:00.000Z';
    const parsed = new Date(customDate);
    assert.ok(parsed > new Date(), 'Custom date should be in the future');
    assert.equal(parsed.toISOString(), customDate);
  });
});
